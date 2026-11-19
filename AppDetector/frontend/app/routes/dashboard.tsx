
import { useEffect, useState } from "react";
import { Link } from "react-router";

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:4000/api"
).replace(/\/$/, "");

// =====================================================
// TIPOS
// =====================================================

type Outcome =
  | "confirmed"
  | "suspected"
  | "not_confirmed"
  | "inconclusive";

type Scenario = {
  id: string;
  name: string;
  base_url: string;
  description?: string;
};

type SecurityReport = {
  attackType?: "SQLI" | "XSS";
  outcome?: Outcome;
  route?: {
    method: string;
    path: string;
  };
};

type StoredReport = {
  id: string;
  created_at: string;
  outcome?: Outcome;
  report: SecurityReport | null;
};

type ScenarioData = {
  scenario: Scenario;
  reports: StoredReport[];
  failed: boolean;
};

type Activity = {
  scenario: Scenario;
  entry: StoredReport;
};

// =====================================================
// COMUNICAÇÃO COM A API
// =====================================================

async function getData<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`);

  const data: unknown = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    const message =
      data &&
        typeof data === "object" &&
        "error" in data
        ? String(data.error)
        : `Erro HTTP ${response.status}`;

    throw new Error(message);
  }

  if (data === null) {
    throw new Error("Resposta inválida da API.");
  }

  return data as T;
}

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

const outcomeLabels: Record<Outcome, string> = {
  confirmed: "Demonstrada",
  suspected: "Suspeita",
  not_confirmed: "Não demonstrada",
  inconclusive: "Inconclusiva",
};

const outcomeColors: Record<Outcome, string> = {
  confirmed: "bg-red-50 text-red-700",
  suspected: "bg-amber-50 text-amber-700",
  not_confirmed: "bg-slate-100 text-slate-700",
  inconclusive: "bg-slate-100 text-slate-600",
};

function getOutcome(
  report: StoredReport
): Outcome | null {
  const value = report.outcome ?? report.report?.outcome;

  if (
    value === "confirmed" ||
    value === "suspected" ||
    value === "not_confirmed" ||
    value === "inconclusive"
  ) {
    return value;
  }

  return null;
}

function timestamp(date: string): number {
  const value = Date.parse(date);
  return Number.isFinite(value) ? value : 0;
}

function formatDate(date?: string): string {
  if (!date || !timestamp(date)) return "—";

  return new Date(date).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function attackLabel(type?: string): string {
  if (type === "SQLI") return "SQL Injection";
  if (type === "XSS") return "XSS";
  return "Teste de segurança";
}

function countAlerts(reports: StoredReport[]): number {
  const routes = new Set<string>();

  for (const entry of reports) {
    if (getOutcome(entry) !== "confirmed") continue;

    const route = entry.report?.route;
    if (!route?.path || !route.method) continue;

    routes.add(`${route.method}:${route.path}`);
  }

  return routes.size;
}

// =====================================================
// COMPONENTES VISUAIS
// =====================================================

function StatCard({
  label,
  value,
  description,
  alert = false,
}: {
  label: string;
  value: number;
  description: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        {label}
      </p>

      <p
        className={`mt-3 text-3xl font-bold tracking-tight ${alert && value > 0
            ? "text-red-600"
            : "text-slate-900"
          }`}
      >
        {value}
      </p>

      <p className="mt-2 text-xs text-slate-500">
        {description}
      </p>
    </div>
  );
}

function OutcomeBadge({
  outcome,
}: {
  outcome: Outcome | null;
}) {
  if (!outcome) {
    return (
      <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
        Resultado indisponível
      </span>
    );
  }

  return (
    <span
      className={`inline-flex rounded-lg px-3 py-1 text-xs font-semibold ${outcomeColors[outcome]
        }`}
    >
      {outcomeLabels[outcome]}
    </span>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="py-10 text-center">
      <p className="text-sm font-semibold text-slate-700">
        {title}
      </p>

      <p className="mt-2 text-sm text-slate-500">
        {description}
      </p>
    </div>
  );
}

// =====================================================
// DASHBOARD
// =====================================================

export default function Dashboard() {
  const [items, setItems] = useState<ScenarioData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAllScenarios, setShowAllScenarios] =
    useState(false);

  async function loadDashboard() {
    setLoading(true);
    setError("");
    setItems([]);

    try {
      // Busca os cenários existentes.
      const scenarios = await getData<Scenario[]>(
        "/security/scenarios"
      );

      if (!Array.isArray(scenarios)) {
        throw new Error(
          "A API retornou uma lista de cenários inválida."
        );
      }

      // Busca até 30 relatórios recentes por cenário.
      const results = await Promise.allSettled(
        scenarios.map(async (scenario) => {
          const reports = await getData<StoredReport[]>(
            `/security/scenarios/${scenario.id}/reports`
          );

          if (!Array.isArray(reports)) {
            throw new Error("Lista de relatórios inválida.");
          }

          return reports;
        })
      );

      const processed: ScenarioData[] = scenarios.map(
        (scenario, index) => {
          const result = results[index];

          if (result.status === "fulfilled") {
            return {
              scenario,
              reports: result.value,
              failed: false,
            };
          }

          return {
            scenario,
            reports: [],
            failed: true,
          };
        }
      );

      setItems(processed);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar o dashboard."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  // -------------------------------------------------
  // INDICADORES REAIS
  // -------------------------------------------------

  const totalScenarios = items.length;

  const failedSources = items.filter(
    (item) => item.failed
  ).length;

  const activities: Activity[] = items
    .flatMap(({ scenario, reports }) =>
      reports.map((entry) => ({
        scenario,
        entry,
      }))
    )
    .sort(
      (a, b) =>
        timestamp(b.entry.created_at) -
        timestamp(a.entry.created_at)
    );

  const totalAssessments = activities.length;

  // Uma rota entra uma única vez, mesmo que tenha
  // várias avaliações confirmadas.
  const alertsMap = new Map<string, Activity>();

  for (const activity of activities) {
    if (getOutcome(activity.entry) !== "confirmed") {
      continue;
    }

    const route = activity.entry.report?.route;

    if (!route?.path || !route.method) {
      continue;
    }

    const key = [
      activity.scenario.id,
      route.method,
      route.path,
    ].join(":");

    if (!alertsMap.has(key)) {
      alertsMap.set(key, activity);
    }
  }

  const alertRoutes = Array.from(alertsMap.values());
  const totalAlertRoutes = alertRoutes.length;

  const recentActivities = activities.slice(0, 6);

  const hasHistoricalLimit = items.some(
    (item) => item.reports.length === 30
  );

  const visibleScenarios = showAllScenarios
    ? items
    : items.slice(0, 6);

  // =================================================
  // INTERFACE
  // =================================================

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      {/* CABEÇALHO */}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
            WebDetector
          </p>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
            Visão geral
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Acompanhe os cenários cadastrados, as
            avaliações realizadas e as vulnerabilidades
            identificadas.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadDashboard()}
            disabled={loading}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? "Atualizando..." : "Atualizar"}
          </button>

          <Link
            to="/monitoramento"
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Analisar aplicação
          </Link>
        </div>
      </header>

      {/* ERROS E CARREGAMENTO */}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {loading && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Carregando informações das aplicações...
        </div>
      )}

      {!loading && !error && (
        <>
          {/* DADOS PARCIAIS */}

          {failedSources > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Não foi possível consultar os relatórios
              de {failedSources} cenário(s).
              Os indicadores abaixo consideram
              somente os dados disponíveis.
            </div>
          )}

          {/* INDICADORES */}

          <section className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Cenários cadastrados"
              value={totalScenarios}
              description="Aplicações configuradas no WebDetector."
            />

            <StatCard
              label="Avaliações consultadas"
              value={totalAssessments}
              description="Relatórios individuais disponíveis no histórico."
            />

            <StatCard
              label="Rotas em alerta"
              value={totalAlertRoutes}
              description="Rotas com vulnerabilidades demonstradas."
              alert
            />
          </section>

          {/* APLICAÇÕES CADASTRADAS */}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Aplicações cadastradas
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Resumo das avaliações de cada cenário.
                </p>
              </div>

              <Link
                to="/configCenario"
                className="text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Novo cenário
              </Link>
            </div>

            {items.length === 0 ? (
              <EmptyState
                title="Nenhuma aplicação cadastrada"
                description="Crie um cenário para começar a analisar sua aplicação."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3">
                        Aplicação
                      </th>

                      <th className="px-5 py-3">
                        Avaliações
                      </th>

                      <th className="px-5 py-3">
                        Alertas
                      </th>

                      <th className="px-5 py-3">
                        Última avaliação
                      </th>

                      <th className="px-5 py-3">
                        Ação
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {visibleScenarios.map((item) => {
                      const sorted = [...item.reports].sort(
                        (a, b) =>
                          timestamp(b.created_at) -
                          timestamp(a.created_at)
                      );

                      const latest = sorted[0];
                      const alerts = countAlerts(
                        item.reports
                      );

                      return (
                        <tr
                          key={item.scenario.id}
                          className="hover:bg-slate-50"
                        >
                          <td className="px-5 py-4">
                            <p className="font-semibold text-slate-900">
                              {item.scenario.name}
                            </p>

                            <p className="mt-1 break-all text-xs text-slate-500">
                              {item.scenario.base_url}
                            </p>
                          </td>

                          <td className="px-5 py-4 text-slate-700">
                            {item.failed
                              ? "Indisponível"
                              : item.reports.length}
                          </td>

                          <td className="px-5 py-4">
                            {item.failed ? (
                              <span className="text-xs text-slate-500">
                                Indisponível
                              </span>
                            ) : alerts > 0 ? (
                              <span className="rounded-lg bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                                {alerts} em alerta
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500">
                                Nenhuma demonstrada
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-4 text-xs text-slate-500">
                            {formatDate(latest?.created_at)}
                          </td>

                          <td className="px-5 py-4">
                            <Link
                              to="/monitoramento"
                              className="font-semibold text-blue-600 hover:text-blue-700"
                            >
                              Monitoramento
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {items.length > 6 && (
                  <div className="flex justify-center border-t border-slate-100 p-4">
                    <button
                      type="button"
                      onClick={() =>
                        setShowAllScenarios((previous) => !previous)
                      }
                      aria-expanded={showAllScenarios}
                      className="rounded-lg px-5 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 hover:text-blue-700"
                    >
                      {showAllScenarios
                        ? "Ver menos"
                        : `Ver mais (${items.length - 6} restantes)`}
                    </button>
                  </div>
                )}

              </div>
            )}
          </section>

          {/* ALERTAS E ATIVIDADE RECENTE */}

          <div className="grid gap-5 lg:grid-cols-2">
            {/* ROTAS EM ALERTA */}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-5">
                <h2 className="text-lg font-bold text-slate-900">
                  Rotas em alerta
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Vulnerabilidades demonstradas em
                  avaliações registradas.
                </p>
              </div>

              {alertRoutes.length === 0 ? (
                <EmptyState
                  title="Nenhum alerta confirmado nos registros"
                  description="Isso não comprova que as aplicações estão livres de vulnerabilidades."
                />
              ) : (
                <div className="divide-y divide-slate-100">
                  {alertRoutes.slice(0, 5).map(
                    ({ scenario, entry }) => (
                      <div
                        key={`${scenario.id}-${entry.id}`}
                        className="p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">
                              {scenario.name}
                            </p>

                            <p className="mt-1 break-all font-mono text-xs text-slate-600">
                              {entry.report?.route?.method}{" "}
                              {entry.report?.route?.path}
                            </p>

                            <p className="mt-2 text-xs text-slate-500">
                              {attackLabel(
                                entry.report?.attackType
                              )}
                            </p>
                          </div>

                          <OutcomeBadge outcome="confirmed" />
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </section>

            {/* ATIVIDADES RECENTES */}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-5">
                <h2 className="text-lg font-bold text-slate-900">
                  Atividade recente
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Últimas avaliações registradas
                  nos cenários.
                </p>
              </div>

              {recentActivities.length === 0 ? (
                <EmptyState
                  title="Nenhuma avaliação registrada"
                  description="Execute uma avaliação para visualizar o histórico."
                />
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentActivities.map(
                    ({ scenario, entry }) => (
                      <div
                        key={`${scenario.id}-${entry.id}`}
                        className="flex flex-wrap items-center justify-between gap-3 p-4"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">
                            {scenario.name}
                          </p>

                          <p className="mt-1 break-all text-xs text-slate-600">
                            {attackLabel(
                              entry.report?.attackType
                            )}
                            {" · "}
                            {entry.report?.route?.path ||
                              "Rota não informada"}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {formatDate(entry.created_at)}
                          </p>
                        </div>

                        <OutcomeBadge
                          outcome={getOutcome(entry)}
                        />
                      </div>
                    )
                  )}
                </div>
              )}
            </section>
          </div>

          {/* INFORMAÇÃO SOBRE A ORIGEM DOS DADOS */}

          <p className="text-xs leading-5 text-slate-500">
            Os indicadores utilizam até 30 avaliações
            individuais recentes por cenário, conforme
            o limite atual da API. Não representam
            necessariamente todo o histórico.
            {hasHistoricalLimit &&
              " Um ou mais cenários atingiram esse limite."}
            {" "}
            As varreduras completas ainda não entram
            nesses números enquanto seus resumos não
            forem persistidos no banco.
          </p>
        </>
      )}
    </main>
  );
}
