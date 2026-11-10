
import { useEffect, useState, type FormEvent } from "react";

import {
  listScenarioRoutes,
  createScenarioRoute,
  deleteScenarioRoute,
  type ScenarioRoute,
  type CreateRouteDTO,
} from "../../services/routeService";

import {
  checkScenarioRoute,
  type IntegrationResult,
} from "../../services/integrationService";

import type { Scenario } from "../../services/scenarioService";

interface Props {
  scenarios: Scenario[];
}

export default function ScenarioRoutes({ scenarios }: Props) {
  const [scenarioId, setScenarioId] = useState("");
  const [routes, setRoutes] = useState<ScenarioRoute[]>([]);

  const [form, setForm] = useState<CreateRouteDTO>({
    path: "",
    method: "GET",
    enabled: true,
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [checkingId, setCheckingId] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [checkResult, setCheckResult] =
  useState<IntegrationResult | null>(null);

  useEffect(() => {
    if (
      scenarios.length > 0 &&
      !scenarios.some((scenario) => scenario.id === scenarioId)
    ) {
      setScenarioId(scenarios[0].id);
    }

    if (scenarios.length === 0) {
      setScenarioId("");
    }
  }, [scenarios, scenarioId]);

  useEffect(() => {
    if (!scenarioId) {
      setRoutes([]);
      setCheckResult(null);
      return;
    }

    let active = true;

    async function loadRoutes() {
      setLoading(true);
      setError("");
      setRoutes([]);
      setCheckResult(null);

      try {
        const data = await listScenarioRoutes(scenarioId);

        if (active) {
          setRoutes(data);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Não foi possível carregar as rotas."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadRoutes();

    return () => {
      active = false;
    };
  }, [scenarioId]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!scenarioId) return;

    setError("");
    setSuccess("");
    setCheckResult(null);

    try {
      setSaving(true);

      const created = await createScenarioRoute(
        scenarioId,
        form
      );

      setRoutes((previous) => [...previous, created]);

      setForm({
        path: "",
        method: "GET",
        enabled: true,
      });

      setSuccess("Rota cadastrada com sucesso!");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao cadastrar rota."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(routeId: string) {
    if (!scenarioId) return;

    const confirmed = window.confirm(
      "Deseja realmente excluir esta rota?"
    );

    if (!confirmed) return;

    setDeletingId(routeId);
    setError("");
    setSuccess("");
    setCheckResult(null);

    try {
      await deleteScenarioRoute(scenarioId, routeId);

      setRoutes((previous) =>
        previous.filter((route) => route.id !== routeId)
      );

      setSuccess("Rota excluída com sucesso!");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao excluir rota."
      );
    } finally {
      setDeletingId("");
    }
  }

  async function handleCheckRoute(routeId: string) {
    if (!scenarioId) return;

    setCheckingId(routeId);
    setCheckResult(null);
    setError("");
    setSuccess("");

    try {
      const result = await checkScenarioRoute(
        scenarioId,
        routeId
      );

      setCheckResult(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao verificar a rota."
      );
    } finally {
      setCheckingId("");
    }
  }

  const selectedScenario = scenarios.find(
    (scenario) => scenario.id === scenarioId
  );

  const inputClass =
    "w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">
          Gerenciamento de Rotas
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Configure e teste os endpoints associados a cada cenário.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700"
        >
          {success}
        </div>
      )}

      <div className="mb-6">
        <label
          htmlFor="selected-scenario"
          className="mb-2 block text-sm font-medium text-gray-700"
        >
          Cenário selecionado
        </label>

        <select
          id="selected-scenario"
          className={inputClass}
          value={scenarioId}
          onChange={(event) => {
            setScenarioId(event.target.value);
            setCheckResult(null);
            setSuccess("");
            setError("");
          }}
          disabled={scenarios.length === 0}
        >
          {scenarios.length === 0 && (
            <option value="">
              Nenhum cenário cadastrado
            </option>
          )}

          {scenarios.map((scenario) => (
            <option key={scenario.id} value={scenario.id}>
              {scenario.name}
            </option>
          ))}
        </select>

        {selectedScenario && (
          <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900">
              {selectedScenario.name}
            </p>

            <p className="mt-1 break-all text-xs text-blue-700">
              URL base: {selectedScenario.base_url}
            </p>

            <p className="mt-1 text-xs text-blue-700">
              Ataques selecionados:{" "}
              {selectedScenario.attack_types.join(", ")}
            </p>
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="mb-6 grid grid-cols-1 items-end gap-4 md:grid-cols-4"
      >
        <div>
          <label
            htmlFor="route-method"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Método
          </label>

          <select
            id="route-method"
            className={inputClass}
            value={form.method}
            onChange={(event) =>
              setForm((previous) => ({
                ...previous,
                method: event.target.value as "GET" | "POST",
              }))
            }
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label
            htmlFor="route-path"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Caminho da rota
          </label>

          <input
            id="route-path"
            className={inputClass}
            placeholder="/api/tracking/CHG20260001"
            value={form.path}
            onChange={(event) =>
              setForm((previous) => ({
                ...previous,
                path: event.target.value,
              }))
            }
            maxLength={250}
            pattern="/(?!/).*"
            title="Informe um caminho iniciado por /."
            required
          />

          <p className="mt-1 text-xs text-gray-500">
            Ex.: /api/tracking/CHG20260001
          </p>
        </div>

        <button
          type="submit"
          disabled={!scenarioId || saving}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Adicionar rota"}
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Método</th>
              <th className="px-4 py-3">Rota</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">
                Ações
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  Carregando rotas...
                </td>
              </tr>
            ) : routes.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  Nenhuma rota cadastrada neste cenário.
                </td>
              </tr>
            ) : (
              routes.map((route) => (
                <tr key={route.id}>
                  <td className="px-4 py-4">
                    <span className="rounded-md bg-blue-50 px-2 py-1 font-medium text-blue-700">
                      {route.method}
                    </span>
                  </td>

                  <td className="px-4 py-4 font-medium text-gray-900">
                    <span className="break-all">
                      {route.path}
                    </span>
                  </td>

                  <td className="px-4 py-4">
                    <span
                      className={
                        route.enabled
                          ? "font-medium text-green-600"
                          : "text-gray-500"
                      }
                    >
                      {route.enabled ? "Ativa" : "Inativa"}
                    </span>
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-4">
                      <button
                        type="button"
                        onClick={() =>
                          void handleCheckRoute(route.id)
                        }
                        disabled={
                          !route.enabled ||
                          loading ||
                          checkingId !== "" ||
                          deletingId !== ""
                        }
                        className="whitespace-nowrap text-sm font-medium text-blue-600 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {checkingId === route.id
                          ? "Verificando..."
                          : "Testar rota"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void handleDelete(route.id)
                        }
                        disabled={
                          deletingId !== "" ||
                          checkingId !== ""
                        }
                        className="whitespace-nowrap text-sm font-medium text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingId === route.id
                          ? "Excluindo..."
                          : "Excluir"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {checkResult && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-gray-900">
              Resultado da verificação
            </h3>

            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                checkResult.success
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {checkResult.success
                ? "Sucesso"
                : "Falha"}
            </span>
          </div>

          <div className="grid gap-5 text-sm md:grid-cols-2">
            <div>
              <p className="text-gray-500">
                Cenário
              </p>
              <p className="mt-1 font-semibold text-gray-900">
                {checkResult.scenario.name}
              </p>
            </div>

            <div>
              <p className="text-gray-500">
                Método HTTP
              </p>
              <p className="mt-1 font-semibold text-gray-900">
                {checkResult.route.method}
              </p>
            </div>

            <div>
              <p className="text-gray-500">
                Status HTTP
              </p>
              <p className="mt-1 font-semibold text-gray-900">
                {checkResult.statusCode}
              </p>
            </div>

            <div>
              <p className="text-gray-500">
                Tempo de resposta
              </p>
              <p className="mt-1 font-semibold text-blue-600">
                {checkResult.durationMs} ms
              </p>
            </div>

            <div>
              <p className="text-gray-500">
                Data e hora
              </p>
              <p className="mt-1 font-semibold text-gray-900">
                {new Date(
                  checkResult.timestamp
                ).toLocaleString("pt-BR")}
              </p>
            </div>

            <div>
              <p className="text-gray-500">
                Resultado
              </p>
              <p
                className={`mt-1 font-semibold ${
                  checkResult.success
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {checkResult.success
                  ? "Requisição bem-sucedida"
                  : "Requisição sem sucesso"}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-2 text-sm font-medium text-gray-500">
              URL consultada
            </p>

            <div className="break-all rounded-lg border border-gray-200 bg-white p-3 font-mono text-sm text-gray-800">
              {checkResult.target}
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-2 text-sm font-medium text-gray-500">
              Resposta da aplicação
            </p>

            <pre className="max-h-72 overflow-auto rounded-lg bg-gray-900 p-4 text-xs text-gray-100">
              {JSON.stringify(
                checkResult.response,
                null,
                2
              )}
            </pre>
          </div>
        </div>
      )}
    </section>
  );
}
