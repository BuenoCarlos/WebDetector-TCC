
import { useEffect, useState } from "react";

import type { Scenario } from "../../services/scenarioService";

import {
  listScenarioRoutes,
  type ScenarioRoute,
} from "../../services/routeService";

import {
  startRun,
  getRun,
  listRuns,
  type TestRun,
} from "../../services/runService";

interface Props {
  scenarios: Scenario[];
}

const statusLabels = {
  pending: "Pendente",
  running: "Executando",
  completed: "Concluída",
  failed: "Falhou",
};

export default function ScenarioExecutor({ scenarios }: Props) {
  const [scenarioId, setScenarioId] = useState("");
  const [routeId, setRouteId] = useState("");

  const [routes, setRoutes] = useState<ScenarioRoute[]>([]);
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [currentRun, setCurrentRun] = useState<TestRun | null>(null);

  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!scenarios.some((s) => s.id === scenarioId)) {
      setScenarioId(scenarios[0]?.id || "");
    }
  }, [scenarios, scenarioId]);

  useEffect(() => {
    if (!scenarioId) {
      setRoutes([]);
      setRuns([]);
      setRouteId("");
      setCurrentRun(null);
      return;
    }

    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      setCurrentRun(null);
      setRoutes([]);
      setRouteId("");

      try {
        const [routeData, runData] = await Promise.all([
          listScenarioRoutes(scenarioId),
          listRuns(scenarioId),
        ]);

        if (!active) return;

        const enabledRoutes = routeData.filter(
          (route) => route.enabled
        );

        setRoutes(enabledRoutes);
        setRouteId(enabledRoutes[0]?.id || "");
        setRuns(runData);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Não foi possível carregar os dados."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [scenarioId]);

  // Consulta o progresso enquanto a execução estiver ativa.
  useEffect(() => {
    if (
      !currentRun ||
      !["pending", "running"].includes(currentRun.status)
    ) {
      return;
    }

    let active = true;
    let busy = false;

    const interval = setInterval(async () => {
      if (busy || !active) return;

      busy = true;

      try {
        const updated = await getRun(currentRun.id);

        if (!active) return;

        setCurrentRun(updated);

        if (
          updated.status === "completed" ||
          updated.status === "failed"
        ) {
          setRuns((previous) => [
            updated,
            ...previous.filter((run) => run.id !== updated.id),
          ]);
        }
      } catch {
        if (active) {
          setError("Erro ao consultar o progresso da execução.");
        }
      } finally {
        busy = false;
      }
    }, 1500);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [currentRun?.id, currentRun?.status]);

  async function handleStart() {
    if (!scenarioId || !routeId) return;

    setStarting(true);
    setError("");
    setCurrentRun(null);

    try {
      const run = await startRun(scenarioId, routeId);

      setCurrentRun(run);
      setRuns((previous) => [
        run,
        ...previous.filter((item) => item.id !== run.id),
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível iniciar a execução."
      );
    } finally {
      setStarting(false);
    }
  }

  async function handleViewRun(runId: string) {
    setError("");

    try {
      const run = await getRun(runId);
      setCurrentRun(run);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível consultar a execução."
      );
    }
  }

  const selectedScenario = scenarios.find(
    (scenario) => scenario.id === scenarioId
  );

  const progress = currentRun
    ? Math.min(
        100,
        Math.round(
          (currentRun.total_requests /
            Math.max(currentRun.max_requests, 1)) * 100
        )
      )
    : 0;

  const isRunning =
    starting ||
    currentRun?.status === "pending" ||
    currentRun?.status === "running";

  const inputClass =
    "w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500";

  return (
    <section className="space-y-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Executor de Cenários
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Execute requisições controladas e acompanhe os
          resultados armazenados no Supabase.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label
            htmlFor="executor-scenario"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Cenário
          </label>

          <select
            id="executor-scenario"
            value={scenarioId}
            disabled={isRunning}
            onChange={(event) =>
              setScenarioId(event.target.value)
            }
            className={inputClass}
          >
            {scenarios.length === 0 && (
              <option value="">Nenhum cenário</option>
            )}

            {scenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="executor-route"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Rota
          </label>

          <select
            id="executor-route"
            value={routeId}
            disabled={loading || isRunning}
            onChange={(event) => setRouteId(event.target.value)}
            className={inputClass}
          >
            {routes.length === 0 && (
              <option value="">Nenhuma rota ativa</option>
            )}

            {routes.map((route) => (
              <option key={route.id} value={route.id}>
                {route.method} {route.path}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedScenario && (
        <div className="grid gap-3 rounded-lg bg-blue-50 p-4 text-sm text-blue-900 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-blue-600">
              Máximo de tentativas
            </p>
            <p className="mt-1 font-semibold">
              {selectedScenario.max_requests}
            </p>
          </div>

          <div>
            <p className="text-xs text-blue-600">
              Duração máxima
            </p>
            <p className="mt-1 font-semibold">
              {selectedScenario.duration_seconds}s
            </p>
          </div>

          <div>
            <p className="text-xs text-blue-600">
              Intervalo
            </p>
            <p className="mt-1 font-semibold">
              {selectedScenario.interval_ms}ms
            </p>
          </div>

          <div>
            <p className="text-xs text-blue-600">
              Timeout
            </p>
            <p className="mt-1 font-semibold">
              {selectedScenario.request_timeout_ms}ms
            </p>
          </div>
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => void handleStart()}
          disabled={
            !scenarioId ||
            !routeId ||
            loading ||
            isRunning
          }
          className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {starting
            ? "Iniciando..."
            : isRunning
              ? "Executando..."
              : "Executar cenário"}
        </button>

        <p className="mt-2 text-xs text-gray-500">
          Nesta etapa, são executadas apenas consultas
          benignas GET de rastreamento da ChegaLogo.
        </p>
      </div>

      {currentRun && (
        <div className="space-y-5 rounded-xl border border-gray-200 bg-gray-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold text-gray-900">
              Resultado da execução
            </h3>

            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
              {statusLabels[currentRun.status]}
            </span>
          </div>

          <div>
            <div className="mb-2 flex justify-between text-sm text-gray-600">
              <span>
                {currentRun.total_requests} de{" "}
                {currentRun.max_requests} requisições
              </span>
              <span>{progress}% do limite de requisições</span>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>

            <p className="mt-2 text-xs text-gray-500">
              A execução também pode terminar antes de 100%
              quando atingir o limite de duração.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-white p-4">
              <p className="text-xs text-gray-500">
                Requisições realizadas
              </p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {currentRun.total_requests}
              </p>
            </div>

            <div className="rounded-lg bg-white p-4">
              <p className="text-xs text-gray-500">
                Bem-sucedidas
              </p>
              <p className="mt-1 text-2xl font-bold text-green-600">
                {currentRun.successful_requests}
              </p>
            </div>

            <div className="rounded-lg bg-white p-4">
              <p className="text-xs text-gray-500">
                Falhas
              </p>
              <p className="mt-1 text-2xl font-bold text-red-600">
                {currentRun.failed_requests}
              </p>
            </div>
          </div>

          {currentRun.error_message && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {currentRun.error_message}
            </p>
          )}

          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Nº</th>
                  <th className="px-4 py-3">Status HTTP</th>
                  <th className="px-4 py-3">Tempo</th>
                  <th className="px-4 py-3">Resultado</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {(currentRun.requests ?? []).length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-gray-500"
                    >
                      Aguardando resultados...
                    </td>
                  </tr>
                ) : (
                  currentRun.requests?.map((request) => (
                    <tr key={request.id}>
                      <td className="px-4 py-3">
                        {request.sequence_number}
                      </td>
                      <td className="px-4 py-3">
                        {request.status_code ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        {request.duration_ms === null
                          ? "-"
                          : `${request.duration_ms} ms`}
                      </td>
                      <td
                        className={`px-4 py-3 ${
                          request.success
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {request.success
                          ? "Sucesso"
                          : request.error_message ||
                            "Falha"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-3 font-semibold text-gray-900">
          Histórico de execuções
        </h3>

        {runs.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhuma execução registrada neste cenário.
          </p>
        ) : (
          <div className="space-y-2">
            {runs.slice(0, 10).map((run) => (
              <button
                type="button"
                key={run.id}
                onClick={() => void handleViewRun(run.id)}
                className="flex w-full flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-4 text-left text-sm transition hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {new Date(run.created_at).toLocaleString("pt-BR")}
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    {run.total_requests} requisições
                  </p>
                </div>

                <span className="font-medium text-blue-600">
                  {statusLabels[run.status]}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
