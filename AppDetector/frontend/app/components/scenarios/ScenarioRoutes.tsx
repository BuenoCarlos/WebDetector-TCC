import { useEffect, useState, type FormEvent } from "react";

import {
  listScenarioRoutes,
  createScenarioRoute,
  deleteScenarioRoute,
  type ScenarioRoute,
  type CreateRouteDTO
} from "../../services/routeService";

import type { Scenario } from "../../services/scenarioService";

interface Props {
  scenarios: Scenario[];
}

export default function ScenarioRoutes({ scenarios }: Props) {
  const [scenarioId, setScenarioId] = useState("");
  const [routes, setRoutes] = useState<ScenarioRoute[]>([]);

  const [form, setForm] = useState<CreateRouteDTO>({
    path: "",
    method: "POST",
    enabled: true
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
      return;
    }

    let active = true;

    async function loadRoutes() {
      setLoading(true);
      setError("");
      setRoutes([]);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!scenarioId) return;

    setError("");
    setSuccess("");

    try {
      setSaving(true);

      const created = await createScenarioRoute(
        scenarioId,
        form
      );

      setRoutes((previous) => [...previous, created]);

      setForm({
        path: "",
        method: "POST",
        enabled: true
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

  const inputClass =
    "w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">
          Gerenciamento de Rotas
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Configure os endpoints associados a cada cenário.
        </p>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div role="status" className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
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
            setSuccess("");
          }}
          disabled={scenarios.length === 0}
        >
          {scenarios.length === 0 && (
            <option value="">Nenhum cenário cadastrado</option>
          )}

          {scenarios.map((scenario) => (
            <option key={scenario.id} value={scenario.id}>
              {scenario.name}
            </option>
          ))}
        </select>
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
                method: event.target.value as "GET" | "POST"
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
            placeholder="/login"
            value={form.path}
            onChange={(event) =>
              setForm((previous) => ({
                ...previous,
                path: event.target.value
              }))
            }
            maxLength={250}
            pattern="/(?!/).*"
            title="Informe um caminho iniciado por /, como /login"
            required
          />
        </div>

        <button
          type="submit"
          disabled={!scenarioId || saving}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
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
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  Carregando rotas...
                </td>
              </tr>
            ) : routes.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
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
                    {route.path}
                  </td>

                  <td className="px-4 py-4">
                    <span className={
                      route.enabled
                        ? "text-green-600"
                        : "text-gray-500"
                    }>
                      {route.enabled ? "Ativa" : "Inativa"}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => void handleDelete(route.id)}
                      disabled={deletingId === route.id}
                      className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      {deletingId === route.id
                        ? "Excluindo..."
                        : "Excluir"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
