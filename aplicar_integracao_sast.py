#!/usr/bin/env python3
"""Instala SAST no WebDetector local sem sobrescrever as telas existentes.

Uso: python aplicar_integracao_sast.py "C:\\Projetos\\WebDetector-TCC"
"""
from __future__ import annotations
import argparse
import datetime as dt
import re
import shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent
NEW_FILES = [
    "backend/src/services/sastService.ts",
    "backend/src/routes/sastRoutes.ts",
    "backend/security-rules/webdetector.yml",
    "AppDetector/frontend/app/services/sourceAnalysisService.ts",
    "AppDetector/frontend/app/components/security/CodeAnalysisPanel.tsx",
]

def patch_app(contents: str) -> str:
    if 'from "./routes/sastRoutes"' in contents:
        return contents
    anchor = 'app.use(errorHandler);'
    if anchor not in contents:
        raise RuntimeError("backend/src/app.ts: não encontrei app.use(errorHandler); para adicionar a rota SAST.")
    contents = 'import sastRoutes from "./routes/sastRoutes";\n' + contents
    return contents.replace(anchor, 'app.use("/api", sastRoutes);\n\n' + anchor, 1)

def patch_monitor(contents: str) -> str:
    if '<CodeAnalysisPanel' in contents:
        return contents
    matches = list(re.finditer(r'(?m)^(\s*)</(?:div|main)>\s*\n\s*\);\s*\n\}', contents))
    if not matches:
        raise RuntimeError("monitoramento.tsx: não encontrei o fechamento do componente principal.")
    match = matches[-1]
    contents = contents[:match.start()] + '      <CodeAnalysisPanel scenarios={scenarios} />\n' + contents[match.start():]
    return 'import CodeAnalysisPanel from "../components/security/CodeAnalysisPanel";\n' + contents

def patch_config(contents: str) -> str:
    if 'Caminho do código-fonte (opcional)' in contents:
        return contents
    anchor = 'const [success, setSuccess] = useState("");'
    create = 'setScenarios((previous) => [created, ...previous]);'
    button = '<div className="flex justify-end">'
    if not all(x in contents for x in [anchor,create,button]):
        raise RuntimeError("configCenario.tsx: estrutura diferente; a vinculação opcional será feita pelo Monitoramento.")
    contents = 'import { saveSourcePath } from "../services/sourceAnalysisService";\n' + contents
    contents = contents.replace(anchor, anchor + '\n  const [sourcePath, setSourcePath] = useState("");', 1)
    contents = contents.replace(create, create + '''
      if (sourcePath.trim()) {
        try {
          await saveSourcePath(created.id, sourcePath.trim());
          setSourcePath("");
        } catch (err) {
          setError("Cenário criado, mas não foi possível vincular o código-fonte: " +
            (err instanceof Error ? err.message : "caminho inválido"));
        }
      }''', 1)
    block = '''<section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Análise estática (opcional)</h2>
          <p className="mb-3 mt-1 text-sm text-slate-500">Informe a pasta do código-fonte disponível no computador do backend Node. Você também pode configurar isso depois no Monitoramento.</p>
          <label htmlFor="scenario-source" className="mb-2 block text-sm font-medium text-slate-700">Caminho do código-fonte (opcional)</label>
          <input id="scenario-source" type="text" value={sourcePath}
            onChange={(e) => setSourcePath(e.target.value)}
            placeholder="C:\\Projetos\\WebDetector-TCC\\ChegaLogo"
            className={inputClass} />
        </section>

        '''
    contents = contents.replace(button, block + button, 1)
    return contents

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("project", help="Diretório raiz do repositório WebDetector-TCC")
    parser.add_argument("--dry-run", action="store_true", help="Verifica mudanças sem escrevê-las")
    args = parser.parse_args()
    root = Path(args.project).expanduser().resolve()
    if not (root / "backend/src/app.ts").is_file() or not (root / "AppDetector/frontend/app/routes/monitoramento.tsx").is_file():
        raise SystemExit("Pasta de projeto inválida. Informe o diretório contendo 'backend' e 'AppDetector'.")

    pending: dict[Path, bytes] = {}
    for relative in NEW_FILES:
        data = (HERE / relative).read_bytes()
        pending[root / relative] = data
    patches = [
        ("backend/src/app.ts", patch_app, True),
        ("AppDetector/frontend/app/routes/monitoramento.tsx", patch_monitor, True),
        ("AppDetector/frontend/app/routes/configCenario.tsx", patch_config, False),
    ]
    warnings = []
    for relative, fn, required in patches:
        target = root / relative
        try:
            original = target.read_text(encoding="utf-8")
            revised = fn(original)
            pending[target] = revised.encode("utf-8")
        except Exception as error:
            if required:
                raise SystemExit(f"Instalação interrompida sem alterações: {error}")
            warnings.append(str(error))

    changed = {f:data for f,data in pending.items() if not f.exists() or f.read_bytes() != data}
    print("Arquivos a adicionar/atualizar:", len(changed))
    for f in changed:
        print(" -", f.relative_to(root))
    if warnings:
        for w in warnings: print("AVISO:", w)
    if args.dry_run: return
    if not changed:
        print("Integração já aplicada. Nenhuma alteração.")
        return

    backup = root / ".webdetector-backups" / ("sast-" + dt.datetime.now().strftime("%Y%m%d-%H%M%S"))
    for f in changed:
        if f.exists():
            dest = backup / f.relative_to(root)
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(f, dest)
    try:
        for f, data in changed.items():
            f.parent.mkdir(parents=True, exist_ok=True)
            f.write_bytes(data)
    except Exception:
        for f in changed:
            b = backup / f.relative_to(root)
            if b.exists(): shutil.copy2(b, f)
            elif f.exists(): f.unlink()
        raise
    print("Integração aplicada. Backup dos arquivos alterados:", backup)
    print("Instale Semgrep uma vez e reinicie o backend e o frontend.")

if __name__ == "__main__":
    main()
