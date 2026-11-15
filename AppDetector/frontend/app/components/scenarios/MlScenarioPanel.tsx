import { useState } from "react";
import type { Scenario } from "../../services/scenarioService";
import {
  executeMlScenario, type MlRun, type MlEvent,
} from "../../services/mlLabService";

function appearance(label: string | null) {
  if (!label) return {text: "Sem classificação", badge: "bg-slate-100 text-slate-700"};
  if (["NORMAL", "Valid"].includes(label)) {
    return {text: label, badge: "bg-emerald-100 text-emerald-800"};
  }
  return {text: label, badge: "bg-red-100 text-red-800"};
}

function formatEvidence(event: MlEvent) {
  const ev = event.request_evidence;
  if (!ev) return "Evidência não armazenada nesta execução. Execute novamente após atualizar o backend.";
  return JSON.stringify({
    method: ev.method,
    path: ev.path,
    query: ev.query,
    body: ev.body,
  }, null, 2);
}

function EventDetails({ event }: { event: MlEvent }) {
  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs text-slate-500">Tipo do teste enviado</p>
          <p className="font-semibold text-slate-800">{event.request_evidence?.test_kind ?? event.expected_label}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Algoritmo que classificou</p>
          <p className="font-semibold text-slate-800">{event.algorithm || "Não disponível"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Resposta da aplicação</p>
          <p className="font-semibold text-slate-800">HTTP {event.status_code ?? "Sem resposta"}</p>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-800">O que foi enviado à aplicação</p>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-900 p-4 text-xs leading-5 text-slate-100">{formatEvidence(event)}</pre>
        {event.request_evidence?.note && <p className="mt-2 text-xs text-slate-500">{event.request_evidence.note}</p>}
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-800">Por que o modelo apresentou essa classificação?</p>
        {event.reasons?.length ? (
          <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
            {event.reasons.map((reason, index) => <li key={index}>{reason}</li>)}
          </ul>
        ) : <p className="text-sm text-slate-500">O backendML não retornou uma explicação para esta previsão.</p>}
        <p className="mt-2 text-xs text-slate-500">Indícios relatados pelo detector não são, por si só, prova de vulnerabilidade explorável.</p>
      </div>
      {event.error_message && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{event.error_message}</p>}
    </div>
  );
}

export default function MlScenarioPanel({ scenarios }: { scenarios: Scenario[] }) {
  const [scenarioId, setScenarioId] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MlRun | null>(null);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("ALL");

  async function run() {
    if (!scenarioId) return;
    setRunning(true); setResult(null); setError(""); setExpandedId(null);
    try { setResult(await executeMlScenario(scenarioId)); }
    catch (e) { setError(e instanceof Error ? e.message : "Erro na execução"); }
    finally { setRunning(false); }
  }

  const events = result?.events ?? [];
  const alerts = events.filter(e => e.predicted_label && !["NORMAL", "Valid"].includes(e.predicted_label));
  const normal = events.filter(e => ["NORMAL", "Valid"].includes(e.predicted_label ?? ""));
  const visible = events.filter(e => filter === "ALL" ||
    (filter === "ALERTS" ? !!e.predicted_label && !["NORMAL", "Valid"].includes(e.predicted_label) :
    filter === "NORMAL" ? ["NORMAL", "Valid"].includes(e.predicted_label ?? "") : !e.predicted_label));

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Monitoramento de tentativas</h2>
        <p className="mt-1 text-sm text-slate-500">Veja a requisição enviada, a classificação do backendML e as evidências de cada teste.</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <select value={scenarioId} onChange={e => setScenarioId(e.target.value)} disabled={running}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white p-3 text-sm">
          <option value="">Selecione um cenário</option>
          {scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button type="button" disabled={!scenarioId || running} onClick={() => void run()}
          className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
          {running ? "Executando testes..." : "Executar cenário"}
        </button>
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {result && <>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border p-4"><p className="text-sm text-slate-500">Tentativas realizadas</p><p className="mt-1 text-2xl font-bold">{events.length}</p></div>
          <div className="rounded-xl border p-4"><p className="text-sm text-slate-500">Alertas do modelo</p><p className="mt-1 text-2xl font-bold text-red-600">{alerts.length}</p></div>
          <div className="rounded-xl border p-4"><p className="text-sm text-slate-500">Classificadas normais</p><p className="mt-1 text-2xl font-bold text-emerald-600">{normal.length}</p></div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-700">Execução: {result.status}</p>
          <select value={filter} onChange={e => setFilter(e.target.value)} className="rounded-lg border border-slate-300 p-2 text-sm">
            <option value="ALL">Todas as tentativas</option>
            <option value="ALERTS">Somente alertas</option>
            <option value="NORMAL">Somente normais</option>
            <option value="UNCLASSIFIED">Sem classificação</option>
          </select>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="p-3">Nº</th><th className="p-3">Rota</th><th className="p-3">Teste enviado</th><th className="p-3">Classificação ML</th><th className="p-3">HTTP</th><th className="p-3">Detalhes</th></tr>
            </thead>
            <tbody>
              {visible.map(event => {
                const a = appearance(event.predicted_label);
                return <tr key={event.id} className="border-t border-slate-100 align-top">
                  <td className="p-3">{event.sequence_number}</td>
                  <td className="p-3 font-mono text-xs">{event.method} {event.request_path}</td>
                  <td className="p-3">{event.request_evidence?.test_kind ?? event.expected_label}</td>
                  <td className="p-3"><span className={`rounded-md px-2 py-1 text-xs font-semibold ${a.badge}`}>{a.text}</span></td>
                  <td className="p-3">{event.status_code ?? "—"}</td>
                  <td className="p-3">
                    <button type="button" onClick={() => setExpandedId(expandedId === event.id ? null : event.id)}
                      aria-expanded={expandedId === event.id} className="font-semibold text-blue-700 hover:underline">
                      {expandedId === event.id ? "Fechar" : "Ver tentativa"}
                    </button>
                    {expandedId === event.id && <div className="mt-3 w-[440px] max-w-[80vw]"><EventDetails event={event}/></div>}
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </>}
    </section>
  );
}
