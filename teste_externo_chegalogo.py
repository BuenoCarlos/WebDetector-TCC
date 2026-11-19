"""Teste externo do WebDetector usando amostras rotuladas e uma rota local autorizada.

Uso no PowerShell, a partir da raiz WebDetector-TCC:
  py teste_externo_chegalogo.py --casos avaliacao_externa_casos.csv

Requer backendML rodando na porta 5000 e ChegaLogo em desenvolvimento na 8000.
Usa SOMENTE 127.0.0.1/localhost. Não treina modelos nem altera a aplicação.
"""
from __future__ import annotations
import argparse
import csv
import json
from collections import Counter
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

LABELS = {"norm", "sqli", "xss"}

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

OPENER = build_opener(NoRedirect)

def local_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme != "http" or parsed.hostname not in ("127.0.0.1", "localhost") or not parsed.port:
        raise ValueError("Por segurança, informe somente URL HTTP de localhost com porta explícita.")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("A URL não pode conter usuário, senha, query ou fragmento.")
    return value

def post_json(url: str, body: dict) -> tuple[int, dict]:
    req = Request(url, data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
                  headers={"Content-Type":"application/json"}, method="POST")
    try:
        with OPENER.open(req, timeout=8) as response:
            status = response.status
            raw = response.read(300_000)
    except HTTPError as exc:
        status = exc.code
        raw = exc.read(300_000)
    data = json.loads(raw) if raw else {}
    return status, data if isinstance(data, dict) else {}

def stats(truth_pred: list[tuple[bool,bool]]) -> dict:
    # Positivo = tentativa maliciosa (SQLi ou XSS).
    tp = sum(t and p for t,p in truth_pred)
    tn = sum(not t and not p for t,p in truth_pred)
    fp = sum(not t and p for t,p in truth_pred)
    fn = sum(t and not p for t,p in truth_pred)
    accuracy = (tp+tn)/len(truth_pred) if truth_pred else 0
    precision = tp/(tp+fp) if tp+fp else 0
    recall = tp/(tp+fn) if tp+fn else 0
    f1 = 2*precision*recall/(precision+recall) if precision+recall else 0
    return {"N":len(truth_pred), "TP":tp,"TN":tn,"FP":fp,"FN":fn,
            "FP_%":round(fp/(fp+tn)*100,2) if fp+tn else 0,
            "FN_%":round(fn/(fn+tp)*100,2) if fn+tp else 0,
            "Acuracia_%":round(accuracy*100,2), "Precisao_%":round(precision*100,2),
            "Recall_%":round(recall*100,2), "F1_%":round(f1*100,2)}

def main():
    parser = argparse.ArgumentParser(description="Avaliação externa independente do ML usando HTTP local")
    parser.add_argument("--casos", default="avaliacao_externa_casos.csv")
    parser.add_argument("--ml", default="http://127.0.0.1:5000/api/ml/predict")
    parser.add_argument("--chegalogo", default="http://127.0.0.1:8000/api/lab/login")
    parser.add_argument("--somente-ml", action="store_true", help="Classifica sem enviar os casos ao ChegaLogo")
    parser.add_argument("--saida", default="resultado_externo_chegalogo.csv")
    parser.add_argument("--treino", action="append", default=[],
                        help="CSV de treino com coluna payload, para bloquear exemplos duplicados; pode repetir")
    args = parser.parse_args()
    ml = local_url(args.ml)
    lab = local_url(args.chegalogo)
    if urlparse(lab).path != "/api/lab/login":
        raise SystemExit("Esta demonstração envia requisições somente a /api/lab/login (laboratório local).")

    with open(args.casos, newline="", encoding="utf-8-sig") as f:
        cases = list(csv.DictReader(f))
    required = {"classe_esperada", "payload"}
    if not cases or not required.issubset(cases[0]):
        raise SystemExit("O CSV deve conter pelo menos: classe_esperada,payload.")
    if len(cases) > 200:
        raise SystemExit("Limite de segurança: máximo 200 casos por execução.")
    keys = set()
    for i, item in enumerate(cases, start=2):
        if item["classe_esperada"] not in LABELS:
            raise SystemExit(f"Linha {i}: classe_esperada deve ser norm, sqli ou xss")
        key = item["payload"].casefold().strip()
        if key in keys:
            raise SystemExit(f"Linha {i}: payload repetido, remova duplicatas")
        keys.add(key)
    for train_path in args.treino:
        with open(train_path, newline="", encoding="utf-8-sig") as tf:
            train_reader = csv.DictReader(tf)
            if "payload" not in (train_reader.fieldnames or []):
                raise SystemExit(f"Arquivo de treino {train_path} precisa ter coluna payload")
            old = {row["payload"].casefold().strip() for row in train_reader}
        dupes = [item["id"] if "id" in item else item["payload"][:20]
                 for item in cases if item["payload"].casefold().strip() in old]
        if dupes:
            raise SystemExit(f"AVALIAÇÃO INVÁLIDA: {len(dupes)} payload(s) também no treino ({train_path}). "
                             f"Substitua os casos: {', '.join(dupes[:10])}")
    print(f"Avaliando {len(cases)} casos. Dados de referência: rótulos escritos no CSV. NÃO haverá retreinamento.")
    rows=[]; request_binary=[]; attack_binary=[]; errors=Counter()
    for i, item in enumerate(cases, start=1):
        truth = item["classe_esperada"]
        payload = item["payload"]
        try:
            mstatus, prediction = post_json(ml, {"method":"POST", "field":"username", "payload":payload})
            if mstatus != 200 or "request_ml" not in prediction or "attack_ml" not in prediction:
                raise RuntimeError(f"ML HTTP {mstatus}: {prediction}")
            req_label = str(prediction["request_ml"]["classification"])
            att_label = str(prediction["attack_ml"]["classification"])
            if req_label not in {"Valid", "Anomalous"} or att_label not in LABELS:
                raise RuntimeError(f"Rótulo inesperado: request={req_label} attack={att_label}")
            http_status="não enviado"
            if not args.somente_ml:
                status, _ = post_json(lab, {"username":payload, "password":"senha_invalida"})
                http_status=status
                if status == 404:
                    raise RuntimeError("Laboratório ChegaLogo não disponível (HTTP 404). Inicie em development.")
                if status == 429:
                    raise RuntimeError("Limite HTTP 429 atingido; interrompido para não sobrecarregar a aplicação.")
            real_mal = truth != "norm"
            request_pred = req_label == "Anomalous"
            attack_pred = att_label != "norm"
            request_binary.append((real_mal,request_pred))
            attack_binary.append((real_mal,attack_pred))
            if real_mal and att_label not in {truth, "norm"}: errors["confundiu_SQLi_XSS"]+=1
            rows.append({"id":item.get("id",str(i)),"classe_esperada":truth,
                         "payload":payload,"request_predicao":req_label,
                         "attack_predicao":att_label,"http_chegalogo":http_status,
                         "request_correto":req_label == ("Valid" if truth=="norm" else "Anomalous"),
                         "attack_correto":att_label == truth})
            print(f"{i:3d}/{len(cases)}  esperado={truth:4s}  request={req_label:9s}  ataque={att_label:4s}  HTTP={http_status}")
        except (OSError,URLError,ValueError,RuntimeError) as exc:
            print(f"ERRO no caso {i}: {exc}")
            print("Execução interrompida; nenhuma taxa será divulgada com casos incompletos.")
            return 1
    with open(args.saida,"w",encoding="utf-8-sig",newline="") as f:
        wr=csv.DictWriter(f,fieldnames=list(rows[0]));wr.writeheader();wr.writerows(rows)
    report={"total":len(rows),"request_normal_versus_anomalo":stats(request_binary),
            "attack_normal_versus_malicioso":stats(attack_binary),
            "attack_tipo_acerto_%":round(sum(r["attack_correto"] for r in rows)/len(rows)*100,2),
            "confusoes_SQLi_XSS":errors["confundiu_SQLi_XSS"],
            "matriz_tipos":{truth:{pred:sum(r["classe_esperada"]==truth and r["attack_predicao"]==pred for r in rows)
                                   for pred in ("norm","sqli","xss")} for truth in ("norm","sqli","xss")},
            "aviso":"Teste externo controlado com rótulos definidos antes da classificação; resultados não demonstram exploração real ou generalização em produção."}
    summary_path=Path(args.saida).with_suffix(".json")
    summary_path.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    print("\nRESULTADOS")
    print(json.dumps(report,ensure_ascii=False,indent=2))
    print(f"\nArquivos salvos: {args.saida} e {summary_path}")
    return 0

if __name__=="__main__":
    raise SystemExit(main())
