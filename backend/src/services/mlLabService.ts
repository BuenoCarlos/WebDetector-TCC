import { supabase } from "../config/supabase";
import { createWorkload, type WorkItem } from "./mlWorkload";

const ML_API = process.env.ML_API_URL ?? "http://127.0.0.1:5000/api/ml/predict";
const activeScenarios = new Set<string>();

type Prediction = {
  classification: string;
  severity?: string | null;
  confidence?: number | null;
  algorithm?: string | null;
  reasons?: string[];
};

type LoginObservation = { at: number; account: string; failed: boolean };

function validateLocalTarget(base: string): URL {
  const url = new URL(base);
  if (url.protocol !== "http:" ||
      !["127.0.0.1", "localhost"].includes(url.hostname) ||
      url.pathname !== "/" || url.search || url.hash || url.username || url.password ||
      !url.port || Number(url.port) < 1024 || Number(url.port) > 65535) {
    throw new Error("Use apenas http://127.0.0.1:PORTA ou http://localhost:PORTA da sua aplicação local.");
  }
  url.hostname = "127.0.0.1";
  return url;
}

async function loadOpenApi(base: URL): Promise<Record<string, unknown>> {
  const paths = ["/openapi.json", "/swagger.json", "/api-docs.json", "/api/openapi.json"];
  for (const path of paths) {
    try {
      const response = await fetch(new URL(path, base), {
        method: "GET", redirect: "error", signal: AbortSignal.timeout(3000),
        headers: { Accept: "application/json" },
      });
      if (!response.ok) continue;
      const document: unknown = await response.json();
      if (document && typeof document === "object" && !Array.isArray(document) &&
          "paths" in document && typeof document.paths === "object" && document.paths !== null &&
          ("openapi" in document || "swagger" in document)) {
        return document as Record<string, unknown>;
      }
    } catch {  }
  }
  throw new Error("Aplicação local sem OpenAPI válido. Exponha /openapi.json antes de executar.");
}

function sleep(ms: number) { return new Promise<void>(resolve => setTimeout(resolve, ms)); }

const SECRET_FIELD = /pass(word)?|senha|secret|token|authorization|cookie|api[_-]?key|credential/i;

function sanitizeEvidence(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[objeto profundo omitido]";
  if (typeof value === "string") return value.slice(0, 1500);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map(item => sanitizeEvidence(item, depth + 1));
  if (!value || typeof value !== "object") return null;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 30)
      .map(([key, data]) => [
        key,
        SECRET_FIELD.test(key) ? "[OCULTO]" : sanitizeEvidence(data, depth + 1),
      ])
  );
}

function createRequestEvidence(sample: WorkItem) {
  const body = sanitizeEvidence(sample.body ?? null);
  const query = sanitizeEvidence(sample.query ?? {});
  return {
    method: sample.method,
    path: sample.path,
    query,
    body,
    is_auth: sample.isAuth,
    test_kind: sample.expected, 
    note: sample.isAuth
      ? "Campos de autenticação sensíveis foram ocultados."
      : "Entrada de teste controlado enviada à aplicação local.",
  };
}



function targetFor(base: URL, sample: WorkItem): URL {
  if (!sample.path.startsWith("/") || sample.path.startsWith("//") ||
      sample.path.includes("\\") || sample.path.includes("#") || sample.path.includes("?")) {
    throw new Error(`Caminho inválido: ${sample.path}`);
  }
  const url = new URL(sample.path, base);
  for (const [key, value] of Object.entries(sample.query ?? {})) {
    url.searchParams.set(key, value);
  }
  if (url.origin !== base.origin) throw new Error("Rota fora do destino autorizado.");
  return url;
}

export class MlLabService {
  async executeScenario(scenarioId: string) {
    if (activeScenarios.has(scenarioId)) {
      throw new Error("Este cenário já está sendo executado.");
    }
    activeScenarios.add(scenarioId);
    let runId: string | null = null;
    try {
      const { data: scenario, error: scenarioError } = await supabase
        .from("scenarios")
        .select("id,name,base_url,attack_types,max_requests,interval_ms,request_timeout_ms,duration_seconds")
        .eq("id", scenarioId).maybeSingle();
      if (scenarioError) throw scenarioError;
      if (!scenario) throw new Error("Cenário não encontrado.");

      const base = validateLocalTarget(scenario.base_url);
      const { data: routes, error: routesError } = await supabase
        .from("scenario_routes")
        .select("path,method,enabled")
        .eq("scenario_id", scenarioId)
        .eq("enabled", true);
      if (routesError) throw routesError;
      if (!routes?.length) throw new Error("Selecione pelo menos uma rota ativa no cadastro do cenário.");

      const openapi = await loadOpenApi(base);
      const cases = createWorkload(
        routes,
        openapi,
        Array.isArray(scenario.attack_types) ? scenario.attack_types : [],
        Number(scenario.max_requests ?? 20)
      );

      const durationSeconds = Math.min(120, Math.max(5, Number(scenario.duration_seconds) || 60));
      const intervalMs = Math.min(10000, Math.max(1000, Number(scenario.interval_ms) || 1000));
      const timeoutMs = Math.min(10000, Math.max(1000, Number(scenario.request_timeout_ms) || 5000));
      console.log("[ML] Rotas selecionadas:", routes.map(r => `${r.method} ${r.path}`));
      console.log(`[ML] ${cases.length} testes planejados; duração ${durationSeconds}s`);

      const { data: run, error: runError } = await supabase.from("ml_lab_runs")
        .insert({ scenario_id: scenarioId, status: "running" }).select("id").single();
      if (runError || !run) throw runError || new Error("Não foi possível criar execução ML.");
      runId = run.id;

      const startedAt = performance.now();
      const loginHistory: LoginObservation[] = [];
      let sequence = 0;
      for (const sample of cases) {
        if (performance.now() - startedAt >= durationSeconds * 1000) {
          console.log(`[ML] Parada por duração: ${sequence}/${cases.length}`);
          break;
        }
        const remaining = durationSeconds * 1000 - (performance.now() - startedAt);
        if (remaining < 100) break;
        const requestStarted = performance.now();
        sequence++;
        let statusCode: number | null = null;
        let errorMessage: string | null = null;
        let responseBody: unknown = null;
        try {
          const response = await fetch(targetFor(base, sample), {
            method: sample.method,
            redirect: "error",
            signal: AbortSignal.timeout(Math.max(1, Math.floor(Math.min(timeoutMs, remaining)))),
            headers: { Accept: "application/json", ...(sample.body ? { "Content-Type": "application/json" } : {}) },
            body: sample.body ? JSON.stringify(sample.body) : undefined,
          });
          statusCode = response.status;
          const text = await response.text();

          try { responseBody = JSON.parse(text.slice(0, 2048)); } catch { responseBody = null; }
          if (sample.isAuth && sample.accountKey) {
            // 429 is a rate-limit response, not a bad password.
            const failed = response.status === 401 || response.status === 403;
            loginHistory.push({ at: Date.now(), account: sample.accountKey, failed });
          }
        } catch (error) {
          errorMessage = error instanceof Error ? `Falha HTTP: ${error.name}` : "Falha HTTP desconhecida";
        }
        void responseBody; 
        const durationMs = Number((performance.now() - requestStarted).toFixed(2));

        const now = Date.now();
        const observations = sample.isAuth && sample.accountKey
          ? loginHistory.filter(o => o.account === sample.accountKey && now - o.at <= 60000)
          : [];
        const attempts1m = observations.length;
        const failedLogins1m = observations.filter(o => o.failed).length;

        let prediction: Prediction | null = null;
        try {
          const mlResponse = await fetch(ML_API, {
            method: "POST", redirect: "error", signal: AbortSignal.timeout(5000),
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              method: sample.method,
              path: sample.path,
              payload: sample.payload,
              attempts_1m: attempts1m,
              failed_logins_1m: failedLogins1m,
            }),
          });
          if (!mlResponse.ok) throw new Error(`HTTP ${mlResponse.status}`);
          const result: unknown = await mlResponse.json();
          if (!result || typeof result !== "object" ||
              typeof (result as Prediction).classification !== "string") {
            throw new Error("ML não retornou classification válida");
          }
          prediction = result as Prediction;
        } catch (error) {
          const detail = error instanceof Error ? error.message : "Erro desconhecido";
          errorMessage = [errorMessage, `Falha no ML: ${detail}`].filter(Boolean).join("; ");
        }
        const { error: eventError } = await supabase.from("ml_lab_events").insert({
          run_id: runId,
          sequence_number: sequence,
          expected_label: sample.expected, 
          predicted_label: prediction?.classification ?? null, 
          severity: prediction?.severity ?? null,
          confidence: prediction?.confidence ?? null,
          algorithm: prediction?.algorithm ?? null,
          reasons: Array.isArray(prediction?.reasons) ? prediction.reasons : [],
          method: sample.method,
          request_path: sample.path,
          request_evidence: createRequestEvidence(sample),
          status_code: statusCode,
          duration_ms: durationMs,
          error_message: errorMessage,
        });
        if (eventError) throw eventError;
        if (sequence < cases.length) {
          const timeRemaining = durationSeconds * 1000 - (performance.now() - startedAt);
          if (timeRemaining > 0) await sleep(Math.min(intervalMs, timeRemaining));
        }
      }
      const { error: endError } = await supabase.from("ml_lab_runs")
        .update({ status: "completed", finished_at: new Date().toISOString() }).eq("id", runId);
      if (endError) throw endError;
      if (!runId) throw new Error("Execução não possui ID.");
      return this.getRun(runId);
    } catch (error) {
      if (runId) {
        await supabase.from("ml_lab_runs")
          .update({ status: "failed", error_message: error instanceof Error ? error.message : "Erro na execução",
            finished_at: new Date().toISOString() }).eq("id", runId);
      }
      throw error;
    } finally {
      activeScenarios.delete(scenarioId);
    }
  }

  async getRun(runId: string) {
    const { data: run, error: runError } = await supabase.from("ml_lab_runs")
      .select("*").eq("id", runId).maybeSingle();
    if (runError) throw runError;
    if (!run) throw new Error("Execução não encontrada.");
    const { data: events, error: eventsError } = await supabase.from("ml_lab_events")
      .select("*").eq("run_id", runId).order("sequence_number", { ascending: true });
    if (eventsError) throw eventsError;
    return { ...run, events: events ?? [] };
  }
}
