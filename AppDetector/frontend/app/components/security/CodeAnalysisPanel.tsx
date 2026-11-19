import { useEffect, useState } from "react";
import { getSourceConfig, getSourceRules, runSourceScan, saveSourcePath, type RulesStatus, type RulesProfile, type SastRun } from "../../services/sourceAnalysisService";

type Scenario = { id: string; name: string };

type Props = { scenarios: Scenario[] };

export default function CodeAnalysisPanel({ scenarios }: Props) {
  const [scenarioId, setScenarioId] = useState("local");
  const [sourcePath, setSourcePath] = useState("");
  const [runs, setRuns] = useState<SastRun[]>([]);
  const [selectedRun, setSelectedRun] = useState("");
  const [busy, setBusy] = useState<"loading" | "saving" | "scan" | "">("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expand, setExpand] = useState(false);
  const [rules, setRules] = useState<RulesStatus | null>(null);
  const [profile, setProfile] = useState<RulesProfile>("basic");

  useEffect(() => {
    void getSourceRules().then(data => {
      setRules(data);
      setProfile(data.communityInstalled ? "community" : "basic");
    }).catch(() => { /* mantém perfil básico se consulta falhar */ });
  }, []);

  useEffect(() => {
    setScenarioId((id) => id === "local" || scenarios.some((s) => s.id === id) ? id : "local");
  }, [scenarios]);

  useEffect(() => {
    if (!scenarioId) return;
    let cancelled = false;
    setBusy("loading"); setError(""); setSuccess(""); setRuns([]); setSourcePath(""); setExpand(false);
    getSourceConfig(scenarioId).then((data) => {
      if (cancelled) return;
      setSourcePath(data.sourcePath);
      setRuns(data.runs || []);
      setSelectedRun(data.runs?.[0]?.id || "");
    }).catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Erro ao buscar análise de código.");
    }).finally(() => { if (!cancelled) setBusy(""); });
    return () => { cancelled = true; };
  }, [scenarioId]);

  async function save() {
    setBusy("saving"); setError(""); setSuccess("");
    try {
      const data = await saveSourcePath(scenarioId, sourcePath);
      setSourcePath(data.sourcePath);
      setSuccess("Pasta de código vinculada ao cenário.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao vincular pasta.");
    } finally { setBusy(""); }
  }

  async function scan() {
    setBusy("scan"); setError(""); setSuccess("");
    try {
      const saved = await saveSourcePath(scenarioId, sourcePath);
      setSourcePath(saved.sourcePath);
      const result = await runSourceScan(scenarioId, profile);
      setRuns((prior) => [result, ...prior].slice(0, 10));
      setSelectedRun(result.id);
      setExpand(false);
      setSuccess(`Análise concluída: ${result.summary.total} possíveis problemas encontrados.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na análise estática.");
    } finally { setBusy(""); }
  }

  const current = runs.find((run) => run.id === selectedRun) || runs[0];
  const visible = expand ? current?.findings : current?.findings.slice(0, 5);

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" id="analise-codigo">
      <header>
        <h2 className="text-lg font-bold text-slate-900">Análise do código-fonte</h2>
        <p className="mt-1 text-sm text-slate-500">
          Analise arquivos locais com regras Semgrep. Não executa o código da aplicação e não usa internet.
          As evidências são indícios estáticos, não exploração confirmada.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="sast-scenario" className="mb-2 block text-sm font-semibold text-slate-700">Cenário</label>
          <select id="sast-scenario" value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}
            disabled={Boolean(busy)} className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm">
            <option value="local">Análise local (sem cenário)</option>
            {scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="sast-source" className="mb-2 block text-sm font-semibold text-slate-700">Caminho do código-fonte (opcional)</label>
          <input id="sast-source" value={sourcePath} onChange={(e) => setSourcePath(e.target.value)}
            placeholder="C:\\Projetos\\WebDetector-TCC\\ChegaLogo"
            className="w-full rounded-lg border border-slate-300 p-3 text-sm" />
          <p className="mt-1 text-xs text-slate-500">O caminho deve existir no computador onde roda o backend Node e estar dentro de WD_SOURCE_ROOT.</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <label htmlFor="sast-profile" className="mb-2 block text-sm font-semibold text-slate-700">
          Conjunto de regras Semgrep
        </label>
        <select id="sast-profile" value={profile} onChange={(event) => setProfile(event.target.value as RulesProfile)}
          disabled={Boolean(busy)} className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm md:max-w-md">
          <option value="basic">Básico — 10 regras locais</option>
          <option value="community" disabled={!rules?.communityInstalled}>
            Comunidade — {rules?.communityInstalled ? `${rules.communityRuleFiles} arquivos de regras + 10 iniciais` : "não instalado"}
          </option>
        </select>
        <p className="mt-2 text-xs text-slate-500">
          {rules?.communityInstalled
            ? "Regras comunitárias já baixadas: a análise é executada localmente, sem internet."
            : "Para ampliar a análise, execute uma vez o script baixar_regras_comunidade.py e atualize esta página."}
          {rules?.communityDownloadedAt ? ` Atualização: ${new Date(rules.communityDownloadedAt).toLocaleDateString("pt-BR")}.` : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={Boolean(busy) || !scenarioId} onClick={() => void save()}
          className="rounded-lg border border-blue-200 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50">
          {busy === "saving" ? "Salvando..." : "Salvar caminho"}
        </button>
        <button type="button" disabled={Boolean(busy) || !scenarioId || !sourcePath.trim()}
          onClick={() => void scan()}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
          {busy === "scan" ? "Analisando arquivos..." : "Salvar e analisar código"}
        </button>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {success && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</p>}

      {runs.length > 0 && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h3 className="font-semibold text-slate-800">Resultados registrados</h3>
            <div>
              <label htmlFor="sast-run" className="mb-1 block text-xs text-slate-500">Execução</label>
              <select id="sast-run" value={current?.id || ""} onChange={e => { setSelectedRun(e.target.value); setExpand(false); }}
                className="max-w-full rounded-lg border border-slate-300 p-2 text-sm">
                {runs.map(run => (
                  <option value={run.id} key={run.id}>{new Date(run.createdAt).toLocaleString("pt-BR")}</option>
                ))}
              </select>
            </div>
          </div>

          {current && (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <Stat label="Achados" value={current.summary.total} />
                <Stat label="Alta severidade" value={current.summary.high} danger />
                <Stat label="Não vistos na anterior" value={current.summary.newSincePrevious} />
                <Stat label="Não encontrados no reteste" value={current.summary.fixedSincePrevious} />
              </div>
              {current.ruleset && <p className="text-xs text-slate-500">Regras usadas: {current.ruleset}</p>}
              <p className="text-xs text-slate-500">
                Comparação com a execução anterior do mesmo cenário. Mudanças de linha ou de código podem alterar a identificação dos achados;
                uma ausência no reteste não garante que a vulnerabilidade foi corrigida.
              </p>

              {current.findings.length === 0 ? (
                <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                  Nenhuma ocorrência identificada pelo conjunto de regras instalado. Isso não garante ausência de vulnerabilidades.
                </p>
              ) : (
                <div className="space-y-3">
                  {visible?.map((finding, i) => (
                    <article className="rounded-xl border border-slate-200 p-4" key={`${finding.id}-${i}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-sm text-slate-900">{finding.message}</strong>
                        <span className={`rounded-md px-2 py-1 text-xs font-bold ${finding.severity === "Alta" ? "bg-red-50 text-red-700" : finding.severity === "Média" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                          {finding.severity}
                        </span>
                      </div>
                      <p className="mt-2 break-all font-mono text-xs text-slate-600">{finding.file}:{finding.line}</p>
                      <p className="mt-3 text-sm text-slate-700"><span className="font-semibold">Como melhorar: </span>{finding.solution}</p>
                    </article>
                  ))}
                  {current.findings.length > 5 && (
                    <div className="text-center">
                      <button onClick={() => setExpand(!expand)} type="button"
                        className="rounded-lg px-5 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50">
                        {expand ? "Ver menos" : `Ver mais (${current.findings.length - 5} restantes)`}
                      </button>
                    </div>
                  )}
                </div>
              )}
              {current.warnings.length > 0 && (
                <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
                  Avisos do scanner: {current.warnings.slice(0, 3).join("; ")}
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

function Stat({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${danger && value > 0 ? "text-red-600" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}
