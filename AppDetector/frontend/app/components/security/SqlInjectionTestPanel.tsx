import { useEffect, useState } from "react";
import { listScenarios, type Scenario } from "../../services/scenarioService";
import { listScenarioRoutes, type ScenarioRoute } from "../../services/routeService";

type Evidence = { status: number; success: boolean; userReturned: boolean; sessionCookieReturned: boolean; durationMs: number };
type Result = {
  route: { method: string; path: string };
  field: string;
  outcome: "confirmed" | "inconclusive" | "not_confirmed";
  explanation: string;
  reference: Evidence;
  falseCondition: Evidence | null;
  trueCondition: Evidence | null;
  testPayload: { field: string; value: string } | null;
  ml: { classification: string; algorithm: string | null; reasons: string[] } | null;
};
const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:4000/api";

export default function SqlInjectionTestPanel() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioId, setScenarioId] = useState("");
  const [routes, setRoutes] = useState<ScenarioRoute[]>([]);
  const [routeId, setRouteId] = useState("");
  const [field, setField] = useState<"username" | "password">("username");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listScenarios().then(data => {
      setScenarios(data);
      setScenarioId(data[0]?.id ?? "");
    }).catch(e => setError(e instanceof Error ? e.message : "Erro ao carregar cenários."));
  }, []);
  useEffect(() => {
    setRoutes([]); setRouteId(""); setResult(null);
    if (!scenarioId) return;
    let active = true;
    void listScenarioRoutes(scenarioId).then(data => {
      if (!active) return;
      const allowed = data.filter(r => r.enabled && r.method === "POST" && /\/(login|signin|sign-in)$/i.test(r.path));
      setRoutes(allowed); setRouteId(allowed[0]?.id ?? "");
    }).catch(e => active && setError(e instanceof Error ? e.message : "Erro ao carregar rotas."));
    return () => { active = false; };
  }, [scenarioId]);

  async function run() {
    setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch(`${API_URL}/security/test-sqli`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId, routeId, field }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Falha no teste.");
      setResult(data as Result);
    } catch (e) { setError(e instanceof Error ? e.message : "Erro no teste."); }
    finally { setBusy(false); }
  }
  const names = { confirmed: "Vulnerabilidade demonstrada", not_confirmed: "Não confirmada neste teste", inconclusive: "Inconclusiva" };
  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div><h2 className="text-xl font-bold text-slate-900">Teste real de SQL Injection no login</h2>
        <p className="mt-1 text-sm text-slate-500">Compara um login inválido, uma condição falsa e uma tentativa de bypass. Executa apenas em aplicação HTTP local.</p></div>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-2 text-sm font-medium">Cenário
          <select className="w-full rounded-lg border p-3" value={scenarioId} onChange={e => setScenarioId(e.target.value)}>
            {scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></label>
        <label className="space-y-2 text-sm font-medium">Rota de login cadastrada
          <select className="w-full rounded-lg border p-3" value={routeId} onChange={e => setRouteId(e.target.value)}>
            {routes.length === 0 && <option value="">Nenhuma rota de login POST</option>}
            {routes.map(r => <option key={r.id} value={r.id}>{r.method} {r.path}</option>)}
          </select></label>
        <label className="space-y-2 text-sm font-medium">Campo avaliado
          <select className="w-full rounded-lg border p-3" value={field} onChange={e => setField(e.target.value as "username" | "password")}>
            <option value="username">username</option><option value="password">password</option>
          </select></label>
      </div>
      <button type="button" onClick={() => void run()} disabled={busy || !routeId}
        className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
        {busy ? "Executando verificações..." : "Executar teste SQLi"}</button>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
      {result && <div className="space-y-4 rounded-xl border p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">Resultado — {result.route.method} {result.route.path}</h3>
          <span className={`rounded-lg px-3 py-1 text-sm font-semibold ${result.outcome === "confirmed" ? "bg-red-100 text-red-700" : result.outcome === "inconclusive" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{names[result.outcome]}</span></div>
        <p className="text-sm text-slate-700">{result.explanation}</p>
        <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm"><thead><tr className="border-b"><th className="p-2">Requisição</th><th className="p-2">HTTP</th><th className="p-2">success</th><th className="p-2">Sessão emitida</th></tr></thead><tbody>
          {([ ["Referência inválida",result.reference], ["Condição falsa",result.falseCondition], ["Condição verdadeira",result.trueCondition]] as const).map(([label,data]) => <tr key={label} className="border-b"><td className="p-2">{label}</td><td className="p-2">{data?.status ?? "—"}</td><td className="p-2">{data ? String(data.success) : "—"}</td><td className="p-2">{data ? String(data.sessionCookieReturned) : "—"}</td></tr>)}
        </tbody></table></div>
        {result.testPayload && <div className="rounded-lg bg-slate-50 p-4"><p className="text-xs text-slate-500">Payload enviado em {result.testPayload.field}</p><code className="mt-2 block break-all text-sm">{result.testPayload.value}</code></div>}
        <div className="rounded-lg bg-slate-50 p-4"><p className="text-sm font-semibold">Classificação do backendML</p>
          <p className="mt-1 text-sm">{result.ml ? `${result.ml.classification} — ${result.ml.algorithm ?? "Algoritmo não informado"}` : "Classificação indisponível"}</p>
          {result.ml?.reasons.map((reason,i) => <p key={i} className="mt-1 text-xs text-slate-600">• {reason}</p>)}
        </div>
      </div>}
    </section>
  );
}
