import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync, renameSync, readdirSync } from "node:fs";
import path from "node:path";

type Severity = "Alta" | "Média" | "Baixa";
export type Finding = {
  id: string;
  ruleId: string;
  severity: Severity;
  file: string;
  line: number;
  message: string;
  solution: string;
};
export type SastRun = {
  id: string;
  scenarioId: string;
  createdAt: string;
  sourcePath: string;
  engine: "Semgrep local";
  ruleset: string;
  summary: { total: number; high: number; medium: number; low: number; fixedSincePrevious: number; newSincePrevious: number };
  findings: Finding[];
  warnings: string[];
};
type ScenarioSast = { sourcePath: string; runs: SastRun[] };
type Store = Record<string, ScenarioSast>;
type SemgrepResult = {
  check_id?: string;
  path?: string;
  start?: { line?: number };
  extra?: { severity?: string; message?: string; lines?: string; fix?: string };
};
type SemgrepOutput = { results?: SemgrepResult[]; errors?: Array<{ message?: string }> };
export type RulesProfile = "basic" | "community";
export type RulesStatus = {
  communityInstalled: boolean;
  communityRuleFiles: number;
  languages: Record<string, number>;
  communityDownloadedAt: string | null;
};

const STORE_PATH = path.resolve(process.cwd(), "data", "webdetector-sast.json");
const RULES = path.resolve(__dirname, "../../security-rules/webdetector.yml");
const COMMUNITY_RULES = path.resolve(__dirname, "../../security-rules/community");
const COMMUNITY_MANIFEST = path.join(COMMUNITY_RULES, "manifest.json");

export function getSastRulesStatus(): RulesStatus {
  try {
    const manifest = JSON.parse(readFileSync(COMMUNITY_MANIFEST, "utf8")) as {
      ruleFiles?: number; languages?: Record<string, number>; downloadedAt?: string;
    };
    const count = Number(manifest.ruleFiles || 0);
    return { communityInstalled: count > 0 && existsSync(COMMUNITY_RULES),
      communityRuleFiles: count, languages: manifest.languages || {},
      communityDownloadedAt: manifest.downloadedAt || null };
  } catch {
    return { communityInstalled: false, communityRuleFiles: 0, languages: {}, communityDownloadedAt: null };
  }
}

// Localiza instalação por pip no Windows mesmo sem PATH global (caso comum).
function semgrepExecutable(): string {
  if (process.env.WD_SEMGREP_BIN?.trim()) return process.env.WD_SEMGREP_BIN.trim();
  if (process.platform === "win32") {
    const roots = [
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Python"),
      process.env.APPDATA && path.join(process.env.APPDATA, "Python"),
    ].filter((v): v is string => Boolean(v));
    for (const root of roots) {
      try {
        for (const folder of readdirSync(root)) {
          const script = path.join(root, folder, "Scripts", "semgrep.exe");
          if (existsSync(script)) return script;
        }
      } catch { /* PATH é a alternativa */ }
    }
  }
  return "semgrep";
}

function generalRecommendation(ruleId: string, message: string): string {
  const text = `${ruleId} ${message}`.toLowerCase();
  if (/sql|sqli|query-injection/.test(text)) return "Use consultas parametrizadas e confirme se entradas do usuário podem alcançar a consulta.";
  if (/xss|innerhtml|html.injection|cross.site.script/.test(text)) return "Codifique a saída conforme o contexto e evite interpretar HTML de origem não confiável.";
  if (/command|shell|exec\(|os-command/.test(text)) return "Evite construir comandos usando texto externo; prefira chamadas sem shell e valide argumentos.";
  if (/secret|credential|password|token|api.key/.test(text)) return "Revise o armazenamento do segredo, use variáveis de ambiente/cofre e substitua credenciais expostas.";
  if (/ssrf|server.side.request/.test(text)) return "Valide destinos permitidos, bloqueie IPs internos indevidos e revalide redirecionamentos.";
  if (/redirect/.test(text)) return "Restrinja redirecionamentos a destinos previamente autorizados.";
  if (/crypto|hash|tls|ssl/.test(text)) return "Use primitivas criptográficas atuais e configurações seguras recomendadas pela biblioteca.";
  if (/auth|authorization|access.control/.test(text)) return "Revise a autorização no backend, incluindo a identidade e o papel do usuário em cada operação.";
  return "Examine a entrada e o fluxo de dados apontados pela regra; confirme o impacto antes de corrigir.";
}
const active = new Set<string>();

const SOLUTIONS: Record<string, string> = {
  "wd-js-sql-interpolation": "Substitua a montagem da query por SQL parametrizado (placeholders ? / parâmetros vinculados). Valide novamente a rota afetada.",
  "wd-js-sql-concat": "Evite concatenar valores na instrução SQL. Use parâmetros vinculados no driver do banco.",
  "wd-js-eval": "Evite eval com dados recebidos; use um parser ou uma estrutura explícita de operações permitidas.",
  "wd-js-innerhtml": "Não insira conteúdo externo diretamente em innerHTML. Use textContent ou sanitização contextual de HTML.",
  "wd-js-shell": "Evite exec com comandos formados por texto externo. Prefira execFile/spawn sem shell e uma lista permitida de argumentos.",
  "wd-py-sql-fstring": "Use placeholders do driver Python em vez de interpolação em consultas SQL.",
  "wd-py-eval": "Elimine eval de entradas não confiáveis; use parsing e validação de dados.",
  "wd-py-shell": "Evite shell=True em comandos gerados a partir de entradas; prefira listas de argumentos e validação.",
  "wd-php-eval": "Evite eval; substitua por funções/operações permitidas explicitamente.",
  "wd-java-sql-concat": "Use PreparedStatement com parâmetros em vez de concatenar strings na consulta SQL.",
};

function readStore(): Store {
  try {
    if (!existsSync(STORE_PATH)) return {};
    return JSON.parse(readFileSync(STORE_PATH, "utf8")) as Store;
  } catch { throw new Error("Histórico SAST local inválido. Verifique data/webdetector-sast.json."); }
}
function writeStore(data: Store): void {
  mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  const tmp = `${STORE_PATH}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 });
  renameSync(tmp, STORE_PATH);
}
function inside(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}
function resolveSource(input: string): string {
  if (!input || input.length > 1024 || input.includes("\0")) {
    throw new Error("Informe uma pasta de código-fonte válida.");
  }
  const root = realpathSync(path.resolve(process.env.WD_SOURCE_ROOT || path.resolve(process.cwd(), "..")));
  const target = realpathSync(path.resolve(root, input.trim()));
  if (!inside(target, root) || !statSync(target).isDirectory()) {
    throw new Error(`Selecione uma pasta dentro da raiz autorizada (${root}).`);
  }
  return target;
}
function prettyError(error: unknown): string {
  return error instanceof Error ? error.message : "Erro desconhecido na análise.";
}

function runSemgrep(target: string, profile: RulesProfile): Promise<SemgrepOutput> {
  if (!existsSync(RULES)) throw new Error(`Regras Semgrep não encontradas: ${RULES}`);
  if (profile === "community" && !getSastRulesStatus().communityInstalled) {
    throw new Error("Regras comunitárias não instaladas. Execute baixar_regras_comunidade.py primeiro.");
  }
  const command = semgrepExecutable();
  const args = [
    "scan", "--config", RULES,
    ...(profile === "community" ? ["--config", COMMUNITY_RULES] : []),
    "--json", "--metrics=off", "--disable-version-check",
    "--max-target-bytes=200000", "--timeout=10", "--jobs=2",
    "--exclude=node_modules", "--exclude=.git", "--exclude=dist", "--exclude=build",
    "--exclude=.next", "--exclude=.venv", "--exclude=venv", "--exclude=coverage",
    "--exclude=*.min.js", "--exclude=*.lock", "--exclude=*.csv", "--exclude=*.json",
    target,
  ];
  const timeout = Number(process.env.WD_SAST_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(timeout) && timeout >= 15000 && timeout <= 300000
    ? timeout : (profile === "community" ? 180000 : 65000);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: target, shell: false, windowsHide: true,
      env: { ...process.env, SEMGREP_SEND_METRICS: "off", SEMGREP_ENABLE_VERSION_CHECK: "0", SEMGREP_APP_TOKEN: "" },
    });
    let output = "";
    let stderr = "";
    let timedOut = false;
    let oversized = false;
    let finished = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
      if (output.length > 12_000_000) { oversized = true; child.kill(); }
    });
    child.stderr.on("data", (chunk: Buffer) => { stderr = (stderr + chunk.toString("utf8")).slice(-8000); });
    child.on("error", (err) => {
      clearTimeout(timer);
      finished = true;
      reject(new Error(`Não foi possível executar Semgrep (${err.message}). Configure WD_SEMGREP_BIN com o caminho completo de semgrep.exe e reinicie o backend.`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (finished) return;
      if (timedOut) { reject(new Error(`A análise excedeu ${Math.round(timeoutMs / 1000)} segundos. Analise uma pasta menor ou ajuste WD_SAST_TIMEOUT_MS.`)); return; }
      if (oversized) { reject(new Error("Saída muito grande. Analise uma pasta menor.")); return; }
      try {
        const parsed = JSON.parse(output) as SemgrepOutput;
        const errors = (parsed.errors || []).map(e => e.message || "Erro de regra");
        if (code !== 0 && (!parsed.results || parsed.results.length === 0)) {
          throw new Error(errors.join("; ") || stderr || `Semgrep encerrou com código ${code}`);
        }
        resolve(parsed);
      } catch (err) {
        reject(new Error(`Falha ao analisar projeto: ${prettyError(err)}. ${stderr.slice(0, 300)}`));
      }
    });
  });
}

export class SastService {
  async getConfig(id: string) {
    return readStore()[id] || { sourcePath: "", runs: [] };
  }

  async saveConfig(id: string, sourcePath: string) {
    const store = readStore();
    const previous = store[id] || { sourcePath: "", runs: [] };
    // Caminho vazio remove a vinculação, preservando o histórico.
    const resolved = sourcePath.trim() ? resolveSource(sourcePath) : "";
    store[id] = { ...previous, sourcePath: resolved };
    writeStore(store);
    return { sourcePath: resolved };
  }

  async scan(id: string, profile: RulesProfile = "basic"): Promise<SastRun> {
    if (active.has(id)) throw new Error("Já existe análise estática em execução neste cenário.");
    active.add(id);
    try {
      const store = readStore();
      const config = store[id];
      if (!config?.sourcePath) throw new Error("Configure a pasta do código-fonte antes de analisar.");
      const target = resolveSource(config.sourcePath); // revalida permissão e caminho real
      const result = await runSemgrep(target, profile);
      const found = result.results || [];
      const findings: Finding[] = found.slice(0, 500).map((item) => {
        const ruleId = item.check_id || "desconhecida";
        const shortRuleId = ruleId.split(".").at(-1) || ruleId;
        const rawFile = path.resolve(target, item.path || "");
        const file = inside(rawFile, target) ? path.relative(target, rawFile).replace(/\\/g, "/") : "[caminho omitido]";
        const line = Number(item.start?.line || 0);
        const severity: Severity = item.extra?.severity === "ERROR" ? "Alta" : item.extra?.severity === "WARNING" ? "Média" : "Baixa";
        const digest = createHash("sha256").update(`${ruleId}:${file}:${line}:${String(item.extra?.lines || "").trim()}`).digest("hex").slice(0, 16);
        return { id: digest, ruleId, severity, file, line,
          message: (item.extra?.message || "Possível problema de segurança.").slice(0, 600),
          solution: SOLUTIONS[shortRuleId] || generalRecommendation(ruleId, item.extra?.message || ""), };
      });
      const previous = config.runs[0];
      const before = new Set(previous?.findings.map(x => x.id) || []);
      const after = new Set(findings.map(x => x.id));
      const run: SastRun = {
        id: randomUUID(), scenarioId: id, createdAt: new Date().toISOString(), sourcePath: target,
        engine: "Semgrep local", ruleset: profile === "community" ? `WebDetector + comunidade (${getSastRulesStatus().communityRuleFiles} arquivos de regras)` : "WebDetector (10 regras)",
        summary: {
          total: found.length,
          high: findings.filter(x => x.severity === "Alta").length,
          medium: findings.filter(x => x.severity === "Média").length,
          low: findings.filter(x => x.severity === "Baixa").length,
          fixedSincePrevious: previous ? [...before].filter(x => !after.has(x)).length : 0,
          newSincePrevious: previous ? [...after].filter(x => !before.has(x)).length : 0,
        },
        findings,
        warnings: [
          ...(found.length > findings.length ? [`Exibidos ${findings.length} dos ${found.length} achados; reduza a pasta para visualizar todos.`] : []),
          ...(result.errors || []).map(x => String(x.message || "Aviso Semgrep").slice(0, 300)),
        ].slice(0, 10),
      };
      const latest = readStore();
      const saved = latest[id] || { sourcePath: target, runs: [] };
      latest[id] = { sourcePath: saved.sourcePath, runs: [run, ...saved.runs].slice(0, 10) };
      writeStore(latest);
      return run;
    } finally { active.delete(id); }
  }
}
