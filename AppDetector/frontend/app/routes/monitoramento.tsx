import { useEffect, useState } from "react";

import {
  HiOutlineShieldCheck,
  HiOutlineRefresh,
  HiOutlineInformationCircle,
} from "react-icons/hi";

import {
  listScenarios,
  type Scenario,
} from "../services/scenarioService";

import MlScenarioPanel from "../components/scenarios/MlScenarioPanel";
import SqlInjectionTestPanel from "../components/security/SqlInjectionTestPanel";

export default function Monitoramento() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadScenarios() {
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
    void loadScenarios();
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-600">
            <HiOutlineShieldCheck className="h-5 w-5" />
            WebDetector Intelligence
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
            Monitoramento de Segurança
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Detecte padrões suspeitos usando Machine Learning
            e analise os resultados dos testes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadScenarios()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <HiOutlineRefresh className="h-4 w-4" />
          Atualizar
        </button>

        
      </div>


      <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <HiOutlineInformationCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />

        <div>
          <h2 className="text-sm font-semibold text-blue-900">
            Detecção inteligente de ameaças
          </h2>

          <p className="mt-1 text-sm leading-6 text-blue-800">
            Os modelos analisam características das requisições
            HTTP e retornam classificações como NORMAL, SQL
            Injection, XSS e Brute Force. Os indícios
            apresentados auxiliam na interpretação dos alertas.
          </p>
        </div>
      </div>

      <SqlInjectionTestPanel />
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
          Carregando cenários...
        </div>
      ) : scenarios.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <HiOutlineShieldCheck className="mx-auto h-10 w-10 text-slate-400" />

          <h2 className="mt-4 text-lg font-semibold text-slate-900">
            Nenhum cenário disponível
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Cadastre um cenário para iniciar os testes.
          </p>
        </div>
      ) : (
        <MlScenarioPanel scenarios={scenarios} />
      )}
    </div>
  );
}
