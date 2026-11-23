import CodeAnalysisPanel from "../components/security/CodeAnalysisPanel";
import { useEffect, useState } from "react";
import ApplicationScanPanel from "../components/security/ApplicationScanPanel";
import { baixarPdfAvaliacaoDetalhado } from "../services/pdfReportService";
import { interpretarML } from "../services/mlInterpretation";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://127.0.0.1:4000/api"
).replace(/\/$/, "");

const inputClass =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const primaryButton =
  "inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButton =
  "inline-flex items-center justify-center rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50";

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
  attack_types: string[];
};

type ScenarioRoute = {
  id: string;
  path: string;
  method: "GET" | "POST";
  enabled: boolean;
  fields: string[];
  kind: string | null;
  valid: boolean;
};

type DiscoverableRoute = {
  path: string;
  method: "GET" | "POST";
  summary: string;
  fields: string[];
  kind: string;
};

type Evidence = {
  status: number;
  content_type: string;
  body_digest: string;
  payload_reflected: boolean;
  flags: Record<string, boolean>;
  identity_fields_present: string[];
  session_cookie_names: string[];
  durationMs: number;
  error?: string;
};

type Prediction = {
  classification: string;
  algorithm: string;
  description: string;
};

type MLClassification = {
  request: Prediction;
  attack: Prediction;
} | null;

type ProbeResult = {
  name: string;
  payload: string;
  outcome: Outcome;
  explanation: string;
  ml: MLClassification;
  ml_error?: string | null;
  signals: Record<string, unknown>;
  recommendations: string[];
  falseCondition: Evidence | null;
  testResponse: Evidence;
  browser?: {
    checked: boolean;
    executed: boolean;
    error?: string;
  };
};

type AssessmentReport = {
  id?: string;
  created_at?: string;
  attackType: Attack;
  route: {
    method: string;
    path: string;
  };
  field: string;
  outcome: Outcome;
  reference: Evidence;
  sentRequests: number;
  executedProbes: number;
  plannedProbes: number;
  explanation: string;
  results: ProbeResult[];
  recommendations: string[];
};

type StoredReport = {
  id: string;
  created_at: string;
  report: AssessmentReport;
};

// CONFIGURAÇÕES E FUNÇÕES AUXILIARES

const outcomeStyles: Record<
  Outcome,
  { label: string; className: string }
> = {
  confirmed: {
    label: "Demonstrada",
    className: "bg-red-100 text-red-800",
  },
  suspected: {
    label: "Suspeita",
    className: "bg-amber-100 text-amber-800",
  },
  not_confirmed: {
    label: "Não demonstrada neste teste",
    className: "bg-slate-100 text-slate-700",
  },
  inconclusive: {
    label: "Inconclusiva",
    className: "bg-slate-100 text-slate-700",
  },
};

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Ocorreu um erro inesperado.";
}

async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

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
    throw new Error(
      "A API retornou uma resposta JSON inválida."
    );
  }

  return data as T;
}

// COMPONENTES VISUAIS

function OutcomeBadge({
  outcome,
}: {
  outcome: Outcome;
}) {
  const display =
    outcomeStyles[outcome] ??
    outcomeStyles.inconclusive;

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${display.className}`}
    >
      {display.label}
    </span>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
        {eyebrow}
      </span>

      <h2 className="text-xl font-bold text-slate-900">
        {title}
      </h2>

      <p className="text-sm leading-6 text-slate-600">
        {description}
      </p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-medium text-slate-500">
        {label}
      </p>

      <p className="mt-1 break-words text-lg font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

// RESULTADOS DA AVALIAÇÃO DE SEGURANÇA

function AssessmentDetails({
  report,
}: {
  report: AssessmentReport;
}) {
  const cards = [
    {
      label: "Campo analisado",
      value: report.field,
    },
    {
      label: "HTTP de referência",
      value: String(report.reference.status),
    },
    {
      label: "Requisições enviadas",
      value: String(report.sentRequests),
    },
    {
      label: "Testes completos",
      value: String(report.executedProbes),
    },
  ];

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
            Resultado da avaliação individual
          </p>

          <h2 className="mt-1 text-lg font-bold text-slate-900">
            {report.attackType} ·{" "}
            {report.route.method}{" "}
            {report.route.path}
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            {report.explanation}
          </p>
        </div>

        <OutcomeBadge outcome={report.outcome} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <SummaryCard
            key={card.label}
            label={card.label}
            value={card.value}
          />
        ))}
      </div>

      {report.results.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Nenhuma tentativa foi concluída.
          Confira a quantidade de requisições,
          a duração e o intervalo configurados
          no cenário.
        </div>
      )}

      {report.results.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[950px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">
                  Tentativa
                </th>

                <th className="px-4 py-3">
                  HTTP controle / teste
                </th>

                <th className="px-4 py-3">
                  ML: requisição
                </th>

                <th className="px-4 py-3">
                  ML: payload
                </th>

                <th className="px-4 py-3">
                  Conclusão
                </th>

                <th className="px-4 py-3">
                  Evidências
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {report.results.map(
                (result, index) => (
                  <tr
                    key={`${result.name}-${index}`}
                    className="align-top hover:bg-slate-50"
                  >
                    <td className="px-4 py-4 font-medium text-slate-900">
                      {result.name}
                    </td>

                    <td className="px-4 py-4 tabular-nums text-slate-700">
                      {result.falseCondition?.status ??
                        "—"}{" "}
                      / {result.testResponse.status}
                    </td>



                    {/* ML: REQUISIÇÃO */}
                    <td className="px-4 py-4 text-slate-700">
                      {result.ml?.request?.classification ?? "Indisponível"}
                    </td>

                    {/* ML: PAYLOAD */}
                    <td className="px-4 py-4 text-slate-700">
                      <p>
                        {result.ml?.attack?.classification ?? "Indisponível"}
                      </p>

                      <span
                        className={`mt-2 inline-block rounded-md px-2 py-1 text-xs font-semibold ${interpretarML(result.ml).className
                          }`}
                      >
                        {interpretarML(result.ml).label}
                      </span>
                    </td>


                    <td className="px-4 py-4">
                      <OutcomeBadge
                        outcome={result.outcome}
                      />
                    </td>

                    <td className="px-4 py-4">
                      <details>
                        <summary className="cursor-pointer font-semibold text-blue-700">
                          Ver detalhes
                        </summary>

                        <div className="mt-3 max-w-sm space-y-2 rounded-lg bg-slate-100 p-3 text-xs text-slate-700">
                          <p>
                            <b>Campo:</b>{" "}
                            {report.field}
                          </p>

                          <p>
                            <b>Payload:</b>{" "}
                            <code className="break-all font-mono">
                              {result.payload}
                            </code>
                          </p>

                          <p>
                            <b>HTTP do teste:</b>{" "}
                            {result.testResponse.status}
                          </p>

                          <p>
                            <b>Tipo de resposta:</b>{" "}
                            {result.testResponse
                              .content_type ||
                              "Não informado"}
                          </p>

                          <p>
                            <b>Payload refletido:</b>{" "}
                            {result.testResponse
                              .payload_reflected
                              ? "Sim"
                              : "Não"}
                          </p>


                          {report.attackType === "XSS" && (
                            <p>
                              <b>JavaScript executado:</b>{" "}
                              {result.browser?.checked && result.browser?.executed
                                ? "Confirmado"
                                : "Não comprovado"}
                            </p>
                          )}


                          <p>
                            {result.explanation}
                          </p>

                          {result.ml_error && (
                            <p className="text-amber-800">
                              ML: {result.ml_error}
                            </p>
                          )}

                          {result.testResponse.error && (
                            <p className="text-red-700">
                              HTTP:{" "}
                              {result.testResponse.error}
                            </p>
                          )}
                        </div>
                      </details>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      {report.recommendations.length > 0 && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <h3 className="font-semibold text-blue-900">
            Possíveis correções
          </h3>

          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-blue-900">
            {report.recommendations.map(
              (recommendation, index) => (
                <li key={index}>
                  {recommendation}
                </li>
              )
            )}
          </ul>
        </div>
      )}

      <p className="text-xs text-slate-500">
        A classificação do ML identifica padrões.
        A confirmação de vulnerabilidade depende
        das evidências produzidas durante os testes.
      </p>
    </section>
  );
}

// PÁGINA PRINCIPAL

export default function SecurityEvaluationPanel() {
  const [scenarios, setScenarios] =
    useState<Scenario[]>([]);

  const [loadingScenarios, setLoadingScenarios] =
    useState(true);

  const [scenarioLoadError, setScenarioLoadError] =
    useState("");

  const [scenarioId, setScenarioId] =
    useState("");

  const [routes, setRoutes] =
    useState<ScenarioRoute[]>([]);

  const [routeId, setRouteId] =
    useState("");

  const [discovered, setDiscovered] =
    useState<DiscoverableRoute[]>([]);

  const [attackType, setAttackType] =
    useState<Attack>("SQLI");

  const [field, setField] =
    useState("");

  const [report, setReport] =
    useState<AssessmentReport | null>(null);

  const [history, setHistory] =
    useState<StoredReport[]>([]);

  const [busy, setBusy] =
    useState(false);

  const [searching, setSearching] =
    useState(false);

  const [discoveryAttempted, setDiscoveryAttempted] =
    useState(false);

  const [error, setError] =
    useState("");

  // CARREGAMENTO DO CENÁRIO

  // Carregar cenários cadastrados no Supabase
  useEffect(() => {
    let active = true;

    async function loadScenarios() {
      try {
        setLoadingScenarios(true);
        setScenarioLoadError("");

        const data = await api<Scenario[]>(
          "/security/scenarios"
        );

        if (active) {
          setScenarios(data);
        }
      } catch (err) {
        if (active) {
          setScenarioLoadError(
            `Erro ao carregar cenários: ${errorMessage(err)}`
          );
        }
      } finally {
        if (active) {
          setLoadingScenarios(false);
        }
      }
    }

    void loadScenarios();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setRoutes([]);
    setRouteId("");
    setDiscovered([]);
    setReport(null);
    setHistory([]);
    setField("");
    setDiscoveryAttempted(false);
    setError("");

    if (!scenarioId) return;

    let active = true;

    void api<ScenarioRoute[]>(
      `/security/scenarios/${scenarioId}/routes`
    )
      .then((data) => {
        if (active) {
          setRoutes(data);
        }
      })
      .catch((err) => {
        if (active) {
          setError(
            `Não foi possível carregar as rotas: ${errorMessage(err)}`
          );
        }
      });

    void api<StoredReport[]>(
      `/security/scenarios/${scenarioId}/reports`
    )
      .then((data) => {
        if (active) {
          setHistory(data);
        }
      })
      .catch((err) => {
        if (active) {
          setError(
            (previous) =>
              previous ||
              `Não foi possível carregar o histórico: ${errorMessage(err)}`
          );
        }
      });

    return () => {
      active = false;
    };
  }, [scenarioId]);

  // DADOS DERIVADOS

  const selectedScenario = scenarios.find(
    (item) => item.id === scenarioId
  );

  const selectedRoute = routes.find(
    (item) => item.id === routeId
  );

  const enabledAttackName =
    attackType === "SQLI"
      ? "SQL Injection"
      : "XSS";

  const canEvaluate = Boolean(
    selectedScenario &&
    routeId &&
    field &&
    !busy &&
    selectedRoute?.valid &&
    selectedScenario.attack_types.includes(
      enabledAttackName
    )
  );

  // DESCOBERTA DAS ROTAS

  async function discover() {
    if (!scenarioId) return;

    setSearching(true);
    setError("");
    setDiscoveryAttempted(true);
    setDiscovered([]);

    try {
      const found =
        await api<DiscoverableRoute[]>(
          `/security/scenarios/${scenarioId}/discover`
        );

      setDiscovered(found);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSearching(false);
    }
  }

  // SELEÇÃO DA ROTA
  async function addRoute(
    route: DiscoverableRoute
  ) {
    if (!scenarioId) return;

    setSearching(true);
    setError("");

    try {
      const created = await api<{
        id: string;
      }>(
        `/security/scenarios/${scenarioId}/select-route`,
        {
          method: "POST",
          body: JSON.stringify({
            path: route.path,
            method: route.method,
          }),
        }
      );

      const updatedRoutes =
        await api<ScenarioRoute[]>(
          `/security/scenarios/${scenarioId}/routes`
        );

      setRoutes(updatedRoutes);
      setRouteId(created.id);

      setField(
        route.fields[0] || ""
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSearching(false);
    }
  }

  // EXECUÇÃO DA AVALIAÇÃO INDIVIDUAL

  async function execute() {
    if (!canEvaluate) return;

    setBusy(true);
    setError("");
    setReport(null);

    try {
      const result =
        await api<AssessmentReport>(
          "/security/evaluate",
          {
            method: "POST",
            body: JSON.stringify({
              scenarioId,
              routeId,
              field,
              attackType,
            }),
          }
        );

      setReport(result);

      try {
        const updatedHistory =
          await api<StoredReport[]>(
            `/security/scenarios/${scenarioId}/reports`
          );

        setHistory(updatedHistory);
      } catch (err) {
        setError(
          `Avaliação concluída, mas o histórico não atualizou: ${errorMessage(err)}`
        );
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // INTERFACE

  return (
    <main className="mx-auto max-w-7xl space-y-7 bg-slate-50 p-4 md:p-6">
      {/* CABEÇALHO */}

      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">
          WebDetector · Monitoramento
        </span>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          Avaliação de segurança
        </h1>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Descubra as operações da aplicação,
          acompanhe a varredura completa e analise
          tentativas reais de SQL Injection e XSS
          com evidências HTTP e classificação
          por Machine Learning.
        </p>
      </header>

      {/* VARREDURA COMPLETA */}

      <ApplicationScanPanel />

      {/* AVALIAÇÃO INDIVIDUAL */}

      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <SectionHeader
          eyebrow="Teste direcionado"
          title="Avaliar uma rota específica"
          description="Escolha o cenário, descubra operações autorizadas, selecione um campo e execute uma avaliação individual."
        />

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Cenário

            <select
              className={inputClass}
              value={scenarioId}
              onChange={(event) =>
                setScenarioId(event.target.value)
              }
            >
              <option value="">
                Selecione um cenário
              </option>

              {scenarios.map((scenario) => (
                <option
                  key={scenario.id}
                  value={scenario.id}
                >
                  {scenario.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Tipo de avaliação

            <select
              className={inputClass}
              value={attackType}
              onChange={(event) =>
                setAttackType(
                  event.target.value as Attack
                )
              }
            >
              <option value="SQLI">
                SQL Injection
              </option>

              <option value="XSS">
                Cross-Site Scripting (XSS)
              </option>
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Rota selecionada

            <select
              className={inputClass}
              value={routeId}
              onChange={(event) => {
                const id = event.target.value;

                setRouteId(id);

                setField(
                  routes.find(
                    (route) => route.id === id
                  )?.fields[0] || ""
                );
              }}
            >
              <option value="">
                Selecione uma operação
              </option>

              {routes
                .filter((route) => route.valid)
                .map((route) => (
                  <option
                    key={route.id}
                    value={route.id}
                  >
                    {route.method} {route.path}
                  </option>
                ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Campo da requisição

            <select
              className={inputClass}
              value={field}
              onChange={(event) =>
                setField(event.target.value)
              }
              disabled={!selectedRoute}
            >
              <option value="">
                Selecione um campo
              </option>

              {(selectedRoute?.fields || []).map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                )
              )}
            </select>
          </label>
        </div>

        {loadingScenarios && (
          <p className="text-sm text-slate-500">
            Carregando cenários cadastrados...
          </p>
        )}

        {scenarioLoadError && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {scenarioLoadError}
          </p>
        )}

        {/* URL DA APLICAÇÃO */}

        {selectedScenario ? (
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">
              Aplicação-alvo:
            </span>{" "}
            {selectedScenario.base_url}
          </div>
        ) : (
          !loadingScenarios &&
          !scenarioLoadError &&
          scenarios.length === 0 && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Nenhum cenário cadastrado. Crie um em{" "}
              <a
                href="/cenario"
                className="font-semibold underline"
              >
                Configuração de Cenários
              </a>.
            </p>
          )
        )}

        {/* BOTÕES DE AÇÃO */}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={secondaryButton}
            onClick={() => void discover()}
            disabled={!scenarioId || searching}
          >
            {searching
              ? "Buscando operações..."
              : "Descobrir rotas pelo OpenAPI"}
          </button>

          <button
            type="button"
            className={primaryButton}
            onClick={() => void execute()}
            disabled={!canEvaluate}
          >
            {busy
              ? "Executando avaliação..."
              : "Executar avaliação individual"}
          </button>
        </div>

        {/* AVISOS DA DESCOBERTA */}

        {discoveryAttempted &&
          !searching &&
          discovered.length === 0 &&
          !error && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Nenhuma operação compatível e
              autorizada para o teste individual
              foi encontrada. Confira o OpenAPI,
              os campos e os contratos de teste.
            </p>
          )}

        {/* ROTAS DESCOBERTAS */}

        {discovered.length > 0 && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-bold text-slate-800">
              Operações disponíveis para
              avaliação individual
            </h3>

            <div className="space-y-2">
              {discovered.map((route) => (
                <div
                  key={`${route.method}-${route.path}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"
                >
                  <div className="min-w-0">
                    <p className="break-all text-sm font-semibold text-slate-800">
                      <span className="mr-2 rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">
                        {route.method}
                      </span>

                      {route.path}
                    </p>

                    <p className="mt-2 text-xs text-slate-500">
                      {route.summary} · Campos:{" "}
                      {route.fields.join(", ") ||
                        "nenhum"}
                    </p>
                  </div>

                  <button
                    type="button"
                    className={secondaryButton}
                    disabled={searching}
                    onClick={() =>
                      void addRoute(route)
                    }
                  >
                    Selecionar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ROTA NÃO AUTORIZADA */}

        {selectedRoute &&
          !selectedRoute.valid && (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              A operação salva não existe ou
              deixou de estar autorizada no
              OpenAPI atual.
            </p>
          )}

        {/* ERROS */}

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <b>Verificação necessária:</b>{" "}
            {error}
          </p>
        )}
      </section>

      {/* RESULTADO DA AVALIAÇÃO INDIVIDUAL */}



      {report && (
        <div className="space-y-4">
          <AssessmentDetails report={report} />

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                const scenarioName =
                  scenarios.find(
                    (scenario) => scenario.id === scenarioId
                  )?.name || "Cenario";

                baixarPdfAvaliacaoDetalhado(report, scenarioName);
              }}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Baixar relatório em PDF
            </button>
          </div>
        </div>
      )}



      {/* HISTÓRICO DE AVALIAÇÕES */}

      {history.length > 0 && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader
            eyebrow="Registro das avaliações"
            title="Histórico do cenário"
            description="Selecione um registro para visualizar os resultados e as evidências salvas."
          />

          <div className="space-y-2">
            {history.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() =>
                  setReport(entry.report)
                }
                className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 text-left text-sm transition hover:bg-slate-50"
              >
                <span className="text-slate-700">
                  {new Date(
                    entry.created_at
                  ).toLocaleString("pt-BR")}{" "}
                  · {entry.report.attackType} ·{" "}
                  {entry.report.route.method}{" "}
                  {entry.report.route.path}
                </span>

                <OutcomeBadge
                  outcome={entry.report.outcome}
                />
              </button>
            ))}
          </div>
        </section>
      )}
      <CodeAnalysisPanel scenarios={scenarios} />
    </main>
  );
}
