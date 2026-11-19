
import { useEffect, useState } from "react";
import { Link } from "react-router";

const API = (
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:4000/api"
).replace(/\/$/, "");

const selectStyle =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

// =====================================================
// TIPOS
// =====================================================

type Attack = "SQLI" | "XSS";

type Outcome =
  | "confirmed"
  | "suspected"
  | "not_confirmed"
  | "inconclusive";

type Scenario = {
  id: string;
  name: string;
  base_url: string;
};

type Report = {
  attackType?: Attack;
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
  report: Report | null;
};

type Summary = {
  total: number;
  routes: number;
  confirmed: number;
  suspected: number;
  inconclusive: number;
  notConfirmed: number;
  latest: string | null;
};

// =====================================================
// API
// =====================================================

async function api<T>(
  path: string,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    signal,
  });

  const data: unknown = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    const detail =
      data &&
      typeof data === "object" &&
      "error" in data
        ? String(data.error)
        : `Erro HTTP ${response.status}`;

    throw new Error(detail);
  }

  if (data === null) {
    throw new Error("Resposta JSON inválida da API.");
  }

  return data as T;
}

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

function outcomeOf(
  item: StoredReport
): Outcome | null {
  const value =
    item.outcome ?? item.report?.outcome;

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

function timeOf(value: string): number {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function formatDate(
  value: string | null
): string {
  if (!value || !timeOf(value)) {
    return "Sem avaliações";
  }

  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function summarize(
  reports: StoredReport[]
): Summary {
  const uniqueRoutes = new Set<string>();

  const result: Summary = {
    total: reports.length,
    routes: 0,
    confirmed: 0,
    suspected: 0,
    inconclusive: 0,
    notConfirmed: 0,
    latest: null,
  };

  for (const item of reports) {
    const route = item.report?.route;

    if (route?.method && route?.path) {
      uniqueRoutes.add(
        `${route.method} ${route.path}`
      );
    }

    const outcome = outcomeOf(item);

    if (outcome === "confirmed") {
      result.confirmed++;
    }

    if (outcome === "suspected") {
      result.suspected++;
    }

    if (outcome === "inconclusive") {
      result.inconclusive++;
    }

    if (outcome === "not_confirmed") {
      result.notConfirmed++;
    }

    if (
      !result.latest ||
      timeOf(item.created_at) > timeOf(result.latest)
    ) {
      result.latest = item.created_at;
    }
  }

  result.routes = uniqueRoutes.size;

  return result;
}

function countAttack(
  reports: StoredReport[],
  attack: Attack
) {
  const selected = reports.filter(
    (report) => report.report?.attackType === attack
  );

  return {
    total: selected.length,
    confirmed: selected.filter(
      (report) => outcomeOf(report) === "confirmed"
    ).length,
    suspected: selected.filter(
      (report) => outcomeOf(report) === "suspected"
    ).length,
    inconclusive: selected.filter(
      (report) => outcomeOf(report) === "inconclusive"
    ).length,
  };
}

function resultKey(
  item: StoredReport
): string | null {
  const route = item.report?.route;
  const attack = item.report?.attackType;

  if (!route?.method || !route?.path || !attack) {
    return null;
  }

  return `${route.method} ${route.path}|${attack}`;
}

function latestByRoute(
  reports: StoredReport[]
): Map<string, StoredReport> {
  const map = new Map<string, StoredReport>();

  const ordered = [...reports].sort(
    (a, b) =>
      timeOf(b.created_at) - timeOf(a.created_at)
  );

  for (const item of ordered) {
    const key = resultKey(item);

    if (key && !map.has(key)) {
      map.set(key, item);
    }
  }

  return map;
}

// =====================================================
// COMPONENTES VISUAIS
// =====================================================

function OutcomeLabel({
  outcome,
}: {
  outcome: Outcome | null;
}) {
  const styles: Record<
    Outcome,
    { name: string; css: string }
  > = {
    confirmed: {
      name: "Demonstrada",
      css: "bg-red-50 text-red-700",
    },
    suspected: {
      name: "Suspeita",
      css: "bg-amber-50 text-amber-800",
    },
    not_confirmed: {
      name: "Não demonstrada",
      css: "bg-slate-100 text-slate-700",
    },
    inconclusive: {
      name: "Inconclusiva",
      css: "bg-slate-100 text-slate-600",
    },
  };

  if (!outcome) {
    return (
      <span className="text-xs text-slate-500">
        Sem classificação
      </span>
    );
  }

  const item = styles[outcome];

  return (
    <span
      className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${item.css}`}
    >
      {item.name}
    </span>
  );
}

// =====================================================
// CARD DE CENÁRIO
// =====================================================

function ComparisonCard({
  scenario,
  summary,
  side,
}: {
  scenario: Scenario;
  summary: Summary;
  side: "A" | "B";
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 font-bold text-blue-700">
          {side}
        </span>

        <div className="min-w-0">
          <h3 className="text-lg font-bold text-slate-900">
            {scenario.name}
          </h3>

          <p className="mt-1 break-all text-xs text-slate-500">
            {scenario.base_url}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs text-slate-500">
            Avaliações registradas
          </p>

          <p className="mt-1 text-2xl font-bold text-slate-900">
            {summary.total}
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs text-slate-500">
            Rotas com avaliação
          </p>

          <p className="mt-1 text-2xl font-bold text-slate-900">
            {summary.routes}
          </p>
        </div>

        <div className="rounded-xl bg-red-50 p-4">
          <p className="text-xs text-red-700">
            Falhas demonstradas
          </p>

          <p className="mt-1 text-2xl font-bold text-red-700">
            {summary.confirmed}
          </p>
        </div>

        <div className="rounded-xl bg-amber-50 p-4">
          <p className="text-xs text-amber-800">
            Resultados suspeitos
          </p>

          <p className="mt-1 text-2xl font-bold text-amber-800">
            {summary.suspected}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
        <span>
          Inconclusivos:{" "}
          <b className="text-slate-800">
            {summary.inconclusive}
          </b>
        </span>

        <span>
          Última avaliação:{" "}
          <b className="text-slate-800">
            {formatDate(summary.latest)}
          </b>
        </span>
      </div>
    </div>
  );
}

// =====================================================
// VULNERABILIDADES DEMONSTRADAS
// =====================================================

function ConfirmedFindings({
  title,
  reports,
}: {
  title: string;
  reports: StoredReport[];
}) {
  const unique = new Map<string, StoredReport>();

  const ordered = [...reports].sort(
    (a, b) =>
      timeOf(b.created_at) - timeOf(a.created_at)
  );

  for (const report of ordered) {
    if (outcomeOf(report) !== "confirmed") {
      continue;
    }

    const key = resultKey(report);

    if (key && !unique.has(key)) {
      unique.set(key, report);
    }
  }

  const findings = [...unique.values()];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-bold text-slate-900">
        {title}
      </h3>

      <p className="mt-1 text-xs text-slate-500">
        Rotas com alguma avaliação que demonstrou
        vulnerabilidade.
      </p>

      {findings.length === 0 ? (
        <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          Nenhuma falha demonstrada nos relatórios
          consultados.
        </p>
      ) : (
        <div className="mt-4 divide-y divide-slate-100">
          {findings.slice(0, 5).map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="break-all font-mono text-xs font-medium text-slate-800">
                  {item.report?.route?.method}{" "}
                  {item.report?.route?.path}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {item.report?.attackType === "SQLI"
                    ? "SQL Injection"
                    : "XSS"}
                  {" · "}
                  {formatDate(item.created_at)}
                </p>
              </div>

              <OutcomeLabel outcome="confirmed" />
            </div>
          ))}

          {findings.length > 5 && (
            <p className="pt-3 text-xs text-slate-500">
              E mais {findings.length - 5} rotas
              com achados demonstrados.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

// =====================================================
// PÁGINA PRINCIPAL
// =====================================================

export default function CompararCenarios() {
  const [scenarios, setScenarios] =
    useState<Scenario[]>([]);

  const [firstId, setFirstId] =
    useState("");

  const [secondId, setSecondId] =
    useState("");

  const [loadingScenarios, setLoadingScenarios] =
    useState(true);

  const [loadingReports, setLoadingReports] =
    useState(false);

  const [reports, setReports] = useState<{
    first: StoredReport[];
    second: StoredReport[];
  } | null>(null);

  const [error, setError] =
    useState("");

  const [refresh, setRefresh] =
    useState(0);

  const [showAllRoutes, setShowAllRoutes] =
    useState(false);

  // ---------------------------------------------------
  // CARREGAR CENÁRIOS
  // ---------------------------------------------------

  useEffect(() => {
    const controller = new AbortController();

    void api<Scenario[]>(
      "/security/scenarios",
      controller.signal
    )
      .then((list) => {
        if (!Array.isArray(list)) {
          throw new Error(
            "Lista de cenários inválida."
          );
        }

        setScenarios(list);
        setFirstId(list[0]?.id ?? "");
        setSecondId(list[1]?.id ?? "");
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Não foi possível carregar os cenários."
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingScenarios(false);
        }
      });

    return () => controller.abort();
  }, []);

  // ---------------------------------------------------
  // CARREGAR RELATÓRIOS DOS DOIS CENÁRIOS
  // ---------------------------------------------------

  useEffect(() => {
    setShowAllRoutes(false);
    setReports(null);

    if (
      !firstId ||
      !secondId ||
      firstId === secondId
    ) {
      return;
    }

    const controller = new AbortController();

    setLoadingReports(true);
    setError("");

    void Promise.all([
      api<StoredReport[]>(
        `/security/scenarios/${firstId}/reports`,
        controller.signal
      ),
      api<StoredReport[]>(
        `/security/scenarios/${secondId}/reports`,
        controller.signal
      ),
    ])
      .then(([first, second]) => {
        if (
          !Array.isArray(first) ||
          !Array.isArray(second)
        ) {
          throw new Error(
            "O backend retornou um histórico inválido."
          );
        }

        if (!controller.signal.aborted) {
          setReports({ first, second });
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Erro ao consultar os relatórios."
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingReports(false);
        }
      });

    return () => controller.abort();
  }, [firstId, secondId, refresh]);

  // ---------------------------------------------------
  // DADOS PARA COMPARAÇÃO
  // ---------------------------------------------------

  const firstScenario = scenarios.find(
    (scenario) => scenario.id === firstId
  );

  const secondScenario = scenarios.find(
    (scenario) => scenario.id === secondId
  );

  const firstStats = reports
    ? summarize(reports.first)
    : null;

  const secondStats = reports
    ? summarize(reports.second)
    : null;

  const firstRoutes = reports
    ? latestByRoute(reports.first)
    : new Map<string, StoredReport>();

  const secondRoutes = reports
    ? latestByRoute(reports.second)
    : new Map<string, StoredReport>();

  const sharedKeys = [...firstRoutes.keys()].filter(
    (key) => secondRoutes.has(key)
  );

  const visibleShared = showAllRoutes
    ? sharedKeys
    : sharedKeys.slice(0, 6);

  // ===================================================
  // INTERFACE
  // ===================================================

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      {/* CABEÇALHO */}

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
            WebDetector
          </p>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
            Comparar cenários
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Compare as avaliações SQL Injection e
            XSS de duas aplicações.
          </p>
        </div>

        <button
          type="button"
          disabled={
            loadingScenarios ||
            loadingReports ||
            !firstId ||
            !secondId
          }
          onClick={() =>
            setRefresh((value) => value + 1)
          }
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Atualizar dados
        </button>
      </header>

      {/* SELEÇÃO DOS CENÁRIOS */}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-900">
            Selecione dois cenários
          </h2>

          <Link
            to="/cenario"
            className="text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            Criar cenário
          </Link>
        </div>

        <p className="mt-1 text-sm text-slate-500">
          Os dados são obtidos dos relatórios reais
          de cada cenário.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Cenário A

            <select
              className={selectStyle}
              value={firstId}
              onChange={(event) =>
                setFirstId(event.target.value)
              }
            >
              <option value="">
                Selecione
              </option>

              {scenarios.map((scenario) => (
                <option
                  key={scenario.id}
                  value={scenario.id}
                  disabled={
                    scenario.id === secondId
                  }
                >
                  {scenario.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            Cenário B

            <select
              className={selectStyle}
              value={secondId}
              onChange={(event) =>
                setSecondId(event.target.value)
              }
            >
              <option value="">
                Selecione
              </option>

              {scenarios.map((scenario) => (
                <option
                  key={scenario.id}
                  value={scenario.id}
                  disabled={
                    scenario.id === firstId
                  }
                >
                  {scenario.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* MENSAGENS */}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {!loadingScenarios &&
        scenarios.length < 2 &&
        !error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Cadastre pelo menos dois cenários para
            realizar a comparação.
          </div>
        )}

      {(loadingScenarios || loadingReports) && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Carregando avaliações dos cenários...
        </div>
      )}

      {/* RESULTADOS */}

      {reports &&
        firstScenario &&
        secondScenario &&
        firstStats &&
        secondStats && (
          <>
            {/* RESUMO LADO A LADO */}

            <section className="grid gap-4 lg:grid-cols-2">
              <ComparisonCard
                scenario={firstScenario}
                summary={firstStats}
                side="A"
              />

              <ComparisonCard
                scenario={secondScenario}
                summary={secondStats}
                side="B"
              />
            </section>

            {/* COMPARAÇÃO SQLI / XSS */}

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">
                Comparação por tipo de ataque
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Quantidade de avaliações e resultados
                demonstrados, separados por SQLi e XSS.
              </p>

              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[570px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">
                        Tipo de avaliação
                      </th>

                      <th className="px-4 py-3">
                        {firstScenario.name}
                      </th>

                      <th className="px-4 py-3">
                        {secondScenario.name}
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {(["SQLI", "XSS"] as const).map(
                      (attack) => {
                        const a = countAttack(
                          reports.first,
                          attack
                        );

                        const b = countAttack(
                          reports.second,
                          attack
                        );

                        return (
                          <tr
                            key={attack}
                            className="align-top"
                          >
                            <td className="px-4 py-4 font-semibold text-slate-800">
                              {attack === "SQLI"
                                ? "SQL Injection"
                                : "XSS"}
                            </td>

                            {[a, b].map(
                              (counts, index) => (
                                <td
                                  key={index}
                                  className="px-4 py-4"
                                >
                                  <p className="font-bold text-slate-900">
                                    {counts.total} avaliações
                                  </p>

                                  <p className="mt-1 text-xs text-red-700">
                                    {counts.confirmed} demonstradas
                                  </p>

                                  <p className="mt-1 text-xs text-slate-500">
                                    {counts.suspected} suspeitas
                                    {" · "}
                                    {counts.inconclusive} inconclusivas
                                  </p>
                                </td>
                              )
                            )}
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            </section>


            {/* ACHADOS DE CADA CENÁRIO */}

            <section className="grid gap-4 lg:grid-cols-2">
              <ConfirmedFindings
                title={`Achados · ${firstScenario.name}`}
                reports={reports.first}
              />

              <ConfirmedFindings
                title={`Achados · ${secondScenario.name}`}
                reports={reports.second}
              />
            </section>
          </>
        )}
    </main>
  );
}
