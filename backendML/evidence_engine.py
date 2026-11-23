"""Avaliação de evidências HTTP. Não usa nome de rota nem previsão do modelo."""
from __future__ import annotations
from typing import Any

SOLUTIONS = {
    'SQLI': [
        'Usar queries parametrizadas/prepared statements; não concatenar entradas em SQL.',
        'Usar validação por tipo e privilégio mínimo na conta do banco.',
        'Usar hash de senha e testar novamente com as mesmas condições falsa/verdadeira.'
    ],
    'XSS': [
        'Escapar/encodar a saída de acordo com o contexto HTML, atributo ou JavaScript.',
        'Evitar innerHTML/dangerouslySetInnerHTML com entradas não confiáveis; preferir textContent.',
        'Sanitizar HTML permitido com biblioteca mantida e adotar Content-Security-Policy complementar.',
        'Repetir o teste no navegador real após corrigir o ponto de renderização.'
    ]
}


def evidence_valid(r: Any) -> bool:
    return (isinstance(r, dict) and isinstance(r.get('status'), int)
            and 100 <= r['status'] < 600 and not r.get('error'))


def auth_success(ev: dict, auth: dict) -> bool:
    if not evidence_valid(ev) or not 200 <= ev['status'] < 300:
        return False
    flags = ev.get('flags') or {}
    identity = ev.get('identity_fields_present') or []
    needed = auth.get('success_fields') or []
    fields = auth.get('identity_fields') or []
    if not needed or not fields or not all(flags.get(k) is True for k in needed):
        return False
    if not any(k in identity for k in fields):
        return False
    if auth.get('confirmation_mode') == 'response':
        return True
    if auth.get('confirmation_mode') == 'session':
        expected = set(auth.get('session_cookie_names') or [])
        return bool(expected.intersection(ev.get('session_cookie_names') or []))
    return False


def analyze(data: dict[str, Any]) -> dict[str, Any]:
    attack = data.get('attackType')
    base = data.get('baseline')
    test = data.get('testResponse')
    control = data.get('falseCondition')
    contract = data.get('contract') if isinstance(data.get('contract'), dict) else {}
    auth = contract.get('auth') if isinstance(contract.get('auth'), dict) else {}
    field = (data.get('request') or {}).get('field', 'desconhecido')
    signals: dict[str, Any] = {}
    if attack not in SOLUTIONS:
        raise ValueError('Tipo de teste inválido: apenas SQLI ou XSS.')
    if not evidence_valid(base) or not evidence_valid(test):
        return {'outcome': 'inconclusive', 'explanation': 'Sem respostas HTTP suficientes para comparação.',
                'signals': signals, 'recommendations': SOLUTIONS[attack]}
    if any(r.get('status') == 429 or r.get('status') >= 500 for r in [base,test,control] if isinstance(r,dict)):
        return {'outcome': 'inconclusive', 'explanation': 'Houve bloqueio (429) ou falha do servidor; não é prova de vulnerabilidade.',
                'signals': signals, 'recommendations': SOLUTIONS[attack]}

    if attack == 'SQLI':
        if not evidence_valid(control):
            outcome, explanation = 'inconclusive', 'Falta o controle SQL com condição falsa.'
        elif contract.get('kind') == 'authentication':
            if not auth or not auth.get('success_fields') or not auth.get('identity_fields'):
                outcome, explanation = 'inconclusive', 'A operação não declara sinais de autenticação verificáveis no OpenAPI.'
            else:
                ref_auth = auth_success(base,auth)
                false_auth = auth_success(control,auth)
                true_auth = auth_success(test,auth)
                signals = {'reference_authenticated':ref_auth,'false_authenticated':false_auth,'true_authenticated':true_auth}
                ref_denied = base['status'] in (400,401,403)
                false_denied = control['status'] in (400,401,403)
                if ref_auth or false_auth:
                    outcome, explanation = 'inconclusive', 'Um controle inesperadamente autenticou; comparação inválida.'
                elif ref_denied and false_denied and true_auth:
                    if auth.get('confirmation_mode') == 'response':
                        outcome = 'confirmed'
                        explanation = f'SQL Injection demonstrada no campo {field}: controles recusados e condição SQL verdadeira produziu autenticação segundo o contrato OpenAPI. Não prova acesso a recursos protegidos adicionais.'
                    else:
                        outcome = 'suspected'
                        explanation = f'O campo {field} resultou em emissão de sessão após condição SQL verdadeira. Verifique uma rota protegida para comprovar uso da sessão.'
                elif ref_denied and false_denied and 200 <= test['status'] < 300:
                    outcome, explanation = 'inconclusive', 'Condição verdadeira retornou HTTP 2xx, mas não comprovou autenticação.'
                elif ref_denied and false_denied:
                    outcome, explanation = 'not_confirmed', 'Os testes não demonstraram bypass de autenticação.'
                else:
                    outcome, explanation = 'inconclusive', 'Controles não apresentaram o comportamento esperado para um login inválido.'
        else:
            # Em rotas de pesquisa, respostas diferentes NÃO demonstram, sozinhas, injeção.
            diff = control.get('body_digest') != test.get('body_digest')
            signals = {'control_and_test_differ':bool(diff)}
            if diff and control.get('status') == test.get('status'):
                outcome, explanation = 'suspected', 'Diferença de resposta entre condições SQL falsa e verdadeira; necessita validação adicional, pois mudanças podem ser normais na pesquisa.'
            elif control.get('status') != test.get('status'):
                outcome, explanation = 'suspected', 'Status HTTP diferente entre condições SQL; investigar antes de confirmar falha.'
            else:
                outcome, explanation = 'not_confirmed', 'Não houve evidência conclusiva de SQL Injection nos testes executados.'
    
    
    else:
        # Verificação de Cross-Site Scripting (XSS)
        browser = data.get("browser") or {}

        reflected = bool(test.get("payload_reflected"))
        checked = browser.get("checked") is True
        reported_executed = browser.get("executed") is True
        executed = checked and reported_executed

        signals = {
            "payload_reflected": reflected,
            "browser_checked": checked,
            "browser_executed": executed,
        }

        if executed:
            outcome = "confirmed"
            explanation = (
                f"XSS demonstrado no campo {field}: "
                "o navegador executou o marcador JavaScript "
                "durante a avaliação controlada."
            )

        elif reported_executed and not checked:
            outcome = "inconclusive"
            explanation = (
                "A execução foi informada, mas não houve "
                "validação efetiva do navegador."
            )

        elif reflected:
            outcome = "suspected"
            explanation = (
                f"O conteúdo enviado no campo {field} "
                "foi refletido na resposta HTTP, mas "
                "a execução de JavaScript não foi comprovada."
            )

        elif browser.get("error"):
            outcome = "inconclusive"
            explanation = (
                "Falha durante a validação de XSS: "
                + str(browser["error"])[:180]
            )

        else:
            outcome = "not_confirmed"
            explanation = (
                "Não foram encontradas evidências suficientes "
                "de XSS neste teste. Isso não comprova "
                "a ausência de vulnerabilidades."
            )

    return {
        "outcome": outcome,
        "explanation": explanation,
        "signals": signals,
        "recommendations": SOLUTIONS[attack],
    }