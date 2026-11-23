#!/usr/bin/env python3
"""Baixa regras comunitárias oficiais do Semgrep para uso local/offline.

Uso: py baixar_regras_comunidade.py "C:\\...\\WebDetector-TCC"
Apenas YAML sob /security/ de linguagens selecionadas. Arquivo é obtido
pelo codeload oficial e nunca é usado para executar código do projeto.
"""
from __future__ import annotations
import argparse
import datetime as dt
import hashlib
import io
import json
import re
import shutil
import sys
import tempfile
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

SOURCE = "https://codeload.github.com/semgrep/semgrep-rules/zip/refs/heads/develop"
REPO = "https://github.com/semgrep/semgrep-rules"
PER_LANG = {"javascript": 48, "typescript": 20, "python": 32, "php": 22, "java": 28, "html": 5}
KEYWORDS = ["sql", "sqli", "xss", "command", "injection", "csrf", "ssrf", "jwt", "auth",
            "path-traversal", "directory-traversal", "open-redirect", "hardcoded", "cookie",
            "deserialize", "eval", "exec", "prototype", "secrets", "password", "crypto",
            "upload", "cors", "header", "template", "xxe", "unsafe", "rce", "redirect"]
FRAMEWORKS = ["express", "nodejs", "node", "react", "javascript", "typescript", "flask", "django",
              "php", "laravel", "spring", "java", "python", "browser", "generic", "html"]

def fetch() -> bytes:
    req = urllib.request.Request(SOURCE, headers={"User-Agent": "WebDetector-TCC-local-rule-updater"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        buf = io.BytesIO()
        limit = 60 * 1024 * 1024
        while True:
            chunk = resp.read(256 * 1024)
            if not chunk:
                break
            if buf.tell() + len(chunk) > limit:
                raise RuntimeError("Arquivo de regras ultrapassa 60 MB compactados.")
            buf.write(chunk)
        return buf.getvalue()

def score(relative: str) -> int:
    name = relative.lower()
    pts = 10 if "/security/" in name else 0
    pts += 5 if "/audit/" not in name else -4
    pts += sum(6 for word in KEYWORDS if word in name)
    pts += sum(3 for word in FRAMEWORKS if f"/{word}/" in name)
    if "/test" in name or "/fixtures" in name:
        pts -= 30
    return pts

def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("project", help="Diretório contendo backend/src e AppDetector")
    args = p.parse_args()
    root = Path(args.project).expanduser().resolve()
    if not (root / "backend/src").is_dir():
        raise SystemExit("Pasta inválida: informe a raiz do WebDetector-TCC (contendo backend/src).")
    dest = root / "backend/security-rules/community"
    print("Baixando regras oficiais de", REPO)
    try:
        data = fetch()
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise SystemExit(f"Não foi possível baixar as regras. É necessária internet apenas nesta atualização: {exc}")
    sha = hashlib.sha256(data).hexdigest()
    selected: dict[str, bytes] = {}
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        by_lang: dict[str, list[tuple[int, str, str]]] = {lang: [] for lang in PER_LANG}
        license_text = None
        for item in z.infolist():
            name = item.filename.replace("\\", "/")
            parts = name.split("/", 1)
            if len(parts) < 2:
                continue
            rel = parts[1]
            if rel == "LICENSE" and item.file_size < 200_000:
                license_text = z.read(item)
            segments = rel.split("/")
            lang = segments[0]
            if (lang not in PER_LANG or "/security/" not in f"/{rel}" or
                not rel.endswith((".yaml", ".yml")) or item.file_size > 200_000 or
                item.file_size == 0 or len(segments) < 3 or ".." in segments):
                continue
            by_lang[lang].append((score(rel), rel, name))
        for lang, limit in PER_LANG.items():
            for _, rel, zip_name in sorted(by_lang[lang], key=lambda item: (-item[0], item[1]))[:limit]:
                content = z.read(zip_name)
                # Evita arquivos de metadados e exemplos que não definem regras.
                if not re.search(rb"(?m)^rules:\s*(?:#.*)?$", content):
                    continue
                selected[rel] = content
    if len(selected) < 30:
        raise SystemExit(f"Poucas regras encontradas ({len(selected)}); nenhuma atualização aplicada.")
    dest.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="webdetector-rules-") as tmp:
        stage = Path(tmp) / "community"
        stage.mkdir()
        for rel, content in selected.items():
            out = stage / rel
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(content)
        if license_text:
            (stage / "LICENSE_SEMGREP_RULES.txt").write_bytes(license_text)
        manifest = {
            "source": REPO, "archive": SOURCE, "downloadedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
            "zipSha256": sha, "ruleFiles": len(selected), "languages": {},
            "note": "Regras comunitárias Semgrep, não os pacotes Pro. Execute offline com --config local.",
        }
        for lang in PER_LANG:
            manifest["languages"][lang] = sum(x.startswith(lang + "/") for x in selected)
        (stage / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
        backup = dest.with_name(dest.name + "-previous")
        if backup.exists():
            shutil.rmtree(backup)
        if dest.exists():
            dest.rename(backup)
        try:
            shutil.copytree(stage, dest)
        except Exception:
            if dest.exists():
                shutil.rmtree(dest)
            if backup.exists():
                backup.rename(dest)
            raise
    print(f"\n{len(selected)} arquivos de regras salvos em {dest}")
    for lang, count in manifest["languages"].items():
        print(f"- {lang}: {count}")
    print("Agora reinicie o backend; o WebDetector usará essas regras SEM internet.")
    print("Regra original webdetector.yml continua ativa. Configuração antiga preservada.")

if __name__ == "__main__":
    main()
