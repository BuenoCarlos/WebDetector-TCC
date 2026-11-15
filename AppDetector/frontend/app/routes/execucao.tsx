import { useEffect, useState } from "react";
import { Link } from "react-router";

import {
  HiOutlinePlay,
  HiOutlineCog,
  HiOutlineRefresh,
} from "react-icons/hi";

import {
  listScenarios,
  type Scenario,
} from "../services/scenarioService";

import ScenarioRoutes from "../components/scenarios/ScenarioRoutes";
import ScenarioExecutor from "../components/scenarios/ScenarioExecutor";

export default function Execucao() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const data = await listScenarios();
      setScenarios(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar os cenários."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-600">
            <HiOutlinePlay className="h-5 w-5" />
            Laboratório de Segurança
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
            Execução de Testes
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Gerencie as rotas e execute testes controlados
            nas aplicações cadastradas.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          <HiOutlineRefresh className="h-4 w-4" />
          Atualizar cenários
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Cenários disponíveis
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {scenarios.length}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Tipos de teste suportados
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            3
          </p>
          <p className="mt-1 text-xs text-slate-500">
            SQLi, XSS e Brute Force no laboratório ML
          </p>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-medium text-blue-800">
            Ambiente de testes
          </p>
          <p className="mt-2 text-lg font-bold text-blue-900">
            Execução controlada
          </p>
          <p className="mt-1 text-xs text-blue-700">
            Destino permitido: ChegaLogo local
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
          Carregando cenários...
        </div>
      ) : scenarios.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <HiOutlineCog className="mx-auto h-10 w-10 text-slate-400" />

          <h2 className="mt-4 text-lg font-semibold text-slate-900">
            Nenhum cenário cadastrado
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Crie seu primeiro cenário antes de executar os testes.
          </p>

          <Link
            to="/configCenario"
            className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Criar cenário
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <ScenarioRoutes scenarios={scenarios} />

          <ScenarioExecutor scenarios={scenarios} />
        </div>
      )}
    </div>
  );
}
