import { supabase } from "../config/supabase";

type ScenarioConfig = {
  id: string;
  name: string;
  base_url: string;
  max_requests: number;
  duration_seconds: number;
  interval_ms: number;
  request_timeout_ms: number;
};

type ScenarioRoute = {
  id: string;
  scenario_id: string;
  path: string;
  method: string;
  enabled: boolean;
};

type RunStatus = "completed" | "failed";

const activeScenarios = new Set<string>();

function validateTarget(
  scenario: ScenarioConfig,
  route: ScenarioRoute
): URL {
  const baseUrl = new URL(scenario.base_url);

  const allowedOrigins = new Set([
    "http://localhost:8000",
    "http://127.0.0.1:8000",
  ]);

  if (
    !allowedOrigins.has(baseUrl.origin) ||
    baseUrl.pathname !== "/" ||
    baseUrl.search ||
    baseUrl.hash ||
    baseUrl.username ||
    baseUrl.password
  ) {
    throw new Error("Destino fora do laboratório autorizado.");
  }

  if (
    route.method !== "GET" ||
    !/^\/api\/tracking\/CHG[0-9]{8}$/.test(route.path)
  ) {
    throw new Error(
      "Esta versão aceita somente rotas GET de rastreamento."
    );
  }

  return new URL(route.path, baseUrl);
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class RunService {
  async start(scenarioId: string, routeId: string) {
    if (activeScenarios.has(scenarioId)) {
      throw new Error("Já existe uma execução ativa neste cenário.");
    }

    const { data: scenario, error: scenarioError } =
      await supabase
        .from("scenarios")
        .select(`
          id,
          name,
          base_url,
          max_requests,
          duration_seconds,
          interval_ms,
          request_timeout_ms
        `)
        .eq("id", scenarioId)
        .single();

    if (scenarioError || !scenario) {
      throw new Error("Cenário não encontrado.");
    }

    const { data: route, error: routeError } =
      await supabase
        .from("scenario_routes")
        .select("id, scenario_id, path, method, enabled")
        .eq("id", routeId)
        .eq("scenario_id", scenarioId)
        .single();

    if (routeError || !route) {
      throw new Error("Rota não encontrada neste cenário.");
    }

    if (!route.enabled) {
      throw new Error("A rota está desativada.");
    }

    const config = scenario as ScenarioConfig;
    const selectedRoute = route as ScenarioRoute;

    const target = validateTarget(config, selectedRoute);

    const maxRequests = Math.min(
      Math.max(config.max_requests, 1),
      100
    );

    const durationSeconds = Math.min(
      Math.max(config.duration_seconds, 5),
      120
    );

    const intervalMs = Math.min(
      Math.max(config.interval_ms, 1000),
      10000
    );

    const timeoutMs = Math.min(
      Math.max(config.request_timeout_ms, 1000),
      10000
    );

    activeScenarios.add(scenarioId);

    try {
      const { data: run, error: insertError } =
        await supabase
          .from("lab_runs")
          .insert({
            scenario_id: scenarioId,
            route_id: routeId,
            status: "pending",
            max_requests: maxRequests,
          })
          .select()
          .single();

      if (insertError || !run) {
        throw new Error(
          insertError?.message ||
          "Não foi possível criar a execução."
        );
      }

      void this.execute(
        run.id as string,
        scenarioId,
        selectedRoute,
        target,
        {
          maxRequests,
          durationSeconds,
          intervalMs,
          timeoutMs,
        }
      ).catch((error) => {
        console.error("[Executor] Erro inesperado:", error);
        activeScenarios.delete(scenarioId);
      });

      return run;
    } catch (error) {
      activeScenarios.delete(scenarioId);
      throw error;
    }
  }

  private async execute(
    runId: string,
    scenarioId: string,
    route: ScenarioRoute,
    target: URL,
    config: {
      maxRequests: number;
      durationSeconds: number;
      intervalMs: number;
      timeoutMs: number;
    }
  ) {
    let total = 0;
    let successful = 0;
    let failed = 0;

    let finalStatus: RunStatus = "completed";
    let finalError: string | null = null;

    try {
      const { error: startError } = await supabase
        .from("lab_runs")
        .update({
          status: "running",
          started_at: new Date().toISOString(),
        })
        .eq("id", runId);

      if (startError) throw startError;

      const startedAt = performance.now();
      const deadline =
        startedAt + config.durationSeconds * 1000;

      for (
        let sequence = 1;
        sequence <= config.maxRequests;
        sequence++
      ) {
        const remainingMs = deadline - performance.now();

        if (remainingMs < 1000) {
          break;
        }

        const requestStartedAt = performance.now();

        let statusCode: number | null = null;
        let success = false;
        let errorMessage: string | null = null;

        try {
            const remainingMs = deadline - performance.now();

            const timeout = Math.max(
              1,
              Math.floor(
                Math.min(config.timeoutMs, remainingMs)
              )
            );

          const response = await fetch(target, {
            method: "GET",
            redirect: "error",
            signal: AbortSignal.timeout(timeout),
            headers: {
              Accept: "application/json",
            },
          });

          statusCode = response.status;

          const contentType =
            response.headers.get("content-type") ?? "";

          if (contentType.includes("application/json")) {
            const body: unknown = await response.json();

            const validResponse =
              typeof body === "object" &&
              body !== null &&
              "success" in body &&
              body.success === true;

            success = response.ok && validResponse;
          } else {
            errorMessage = "Resposta não está em JSON.";
          }
        } catch (error) {
          console.error(
            `[Executor] Requisição ${sequence}:`,
            error
          );

          const isTimeout =
            error instanceof Error &&
            (
              error.name === "TimeoutError" ||
              error.name === "AbortError"
            );

          if (isTimeout) {
            errorMessage =
              performance.now() >= deadline
                ? "Tempo máximo do cenário atingido."
                : "Timeout da requisição.";
          } else {
            errorMessage = "Falha de comunicação com a aplicação.";
          }
        }

        const durationMs = Number(
          (performance.now() - requestStartedAt).toFixed(2)
        );

        const { error: requestError } = await supabase
          .from("lab_run_requests")
          .insert({
            run_id: runId,
            sequence_number: sequence,
            route_path: route.path,
            method: route.method,
            status_code: statusCode,
            success,
            duration_ms: durationMs,
            error_message: errorMessage,
          });

        if (requestError) throw requestError;

        total++;

        if (success) {
          successful++;
        } else {
          failed++;
        }

        const { error: updateError } = await supabase
          .from("lab_runs")
          .update({
            total_requests: total,
            successful_requests: successful,
            failed_requests: failed,
          })
          .eq("id", runId);

        if (updateError) throw updateError;

        if (
          sequence < config.maxRequests &&
          performance.now() < deadline
        ) {
          const remainingTime =
            deadline - performance.now();

          await delay(
            Math.min(
              config.intervalMs,
              Math.max(0, remainingTime)
            )
          );
        }
      }
    } catch (error) {
      finalStatus = "failed";
      finalError =
        error instanceof Error
          ? error.message.slice(0, 500)
          : "Erro durante a execução.";

      console.error("[Executor]", error);
    } finally {
      const { error } = await supabase
        .from("lab_runs")
        .update({
          status: finalStatus,
          total_requests: total,
          successful_requests: successful,
          failed_requests: failed,
          error_message: finalError,
          finished_at: new Date().toISOString(),
        })
        .eq("id", runId);

      if (error) {
        console.error(
          "[Executor] Falha ao atualizar execução:",
          error
        );
      }

      activeScenarios.delete(scenarioId);
    }
  }

  async getById(runId: string) {
    const { data: run, error: runError } = await supabase
      .from("lab_runs")
      .select("*")
      .eq("id", runId)
      .maybeSingle();

    if (runError) throw runError;

    if (!run) {
      throw new Error("RUN_NOT_FOUND");
    }

    const { data: requests, error: requestsError } =
      await supabase
        .from("lab_run_requests")
        .select("*")
        .eq("run_id", runId)
        .order("sequence_number", { ascending: true });

    if (requestsError) throw requestsError;

    return {
      ...run,
      requests: requests ?? [],
    };
  }

  async list(scenarioId: string) {
    const { data, error } = await supabase
      .from("lab_runs")
      .select("*")
      .eq("scenario_id", scenarioId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    return data ?? [];
  }
}