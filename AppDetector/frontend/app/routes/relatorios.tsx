
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";

import {
  baixarPdfVarreduraDetalhado,
  baixarPdfAvaliacaoDetalhado,
} from "../services/pdfReportService";

// =====================================================
// CONFIGURAÇÃO
// =====================================================

const API = (
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:4000/api"
).replace(/\/$/, "");

const selectClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const primaryButton =
  "rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButton =
  "rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50";

// =====================================================
// TIPOS
// =====================================================

type Tab = "scans" | "individual";

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

type ScanTest = {
  state: string;
  outcome?: string;
  field?: string;
  reason?: string;
  reportId?: string;
};

type ScanOperation = {
  method: string;
  path: string;
  summary: string;
  state: string;
  httpStatus: number | null;
  explanation: string;
  sqlInjection: ScanTest;
  xss: ScanTest;
};

type SavedScan = {
  id: string;
  scenario_id: string;
  status: "completed" | "failed";
  started_at: string;
  finished_at: string | null;
  total: number;
  completed: number;
};

type ScanDetail = SavedScan & {
  operations: ScanOperation[];
  auth_results?: Array<{
    profile: string;
    state: string;
    reason: string;
  }>;
  error?: string | null;
};

type Evidence = {
  status: number;
  content_type?: string;
  body_digest?: string;
  durationMs?: number;
  payload_reflected?: boolean;
  error?: string;
};

type MLResult = {
  request?: {
    classification: string;
    algorithm?: string;
  };
  attack?: {
    classification: string;
    algorithm?: string;
  };
} | null;

type Attempt = {
  name: string;
  payload: string;
  outcome: string;
  explanation: string;
  falseCondition?: Evidence | null;
  testResponse: Evidence;
  browser?: {
    checked: boolean;
    executed: boolean;
    error?: string;
  };
  ml?: MLResult;
  ml_error?: string | null;
  signals?: Record<string, unknown>;
  recommendations?: string[];
};

type EvaluationReport = {
  attackType: string;
  route: {
    method: string;
    path: string;
  };
  field: string;
  outcome: string;
  explanation: string;
  sentRequests: number;
  executedProbes: number;
  reference?: Evidence;
  results: Attempt[];
  recommendations?: string[];
};

type StoredEvaluation = {
  id: string;
  scenario_id?: string;
  created_at: string;
  outcome: Outcome;
  report: EvaluationReport;
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
      "A API retornou uma resposta inválida."
    );
  }

  return data as T;
}

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Ocorreu um erro inesperado.";
}

function formatDate(value?: string | null): string {
  if (!value) return "Não informado";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data inválida";
  }

  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function outcomeLabel(value?: string): string {
  const labels: Record<string, string> = {
    confirmed: "Demonstrada",
    suspected: "Suspeita",
    not_confirmed: "Não demonstrada",
    inconclusive: "Inconclusiva",
  };

  return labels[value || ""] || "Não informado";
}

function testLabel(test?: ScanTest): string {
  if (!test) return "Não informado";

  if (test.state === "completed") {
    return outcomeLabel(test.outcome);
  }

  const labels: Record<string, string> = {
    skipped: "Não executado",
    not_applicable: "Não aplicável",
    not_supported_yet: "Não suportado",
    pending: "Pendente",
    error: "Erro",
  };

  return labels[test.state] || test.state;
}

function getOutcomeColor(value?: string): string {
  switch (value) {
    case "confirmed":
      return "bg-red-50 text-red-700";
    case "suspected":
      return "bg-amber-50 text-amber-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

// =====================================================
// COMPONENTES VISUAIS
// =====================================================

function OutcomeBadge({
  outcome,
}: {
  outcome?: string;
}) {
  return (
    <span
      className={`inline-flex rounded-lg px-3 py-1 text-xs font-semibold ${getOutcomeColor(
        outcome
      )}`}
    >
      {outcomeLabel(outcome)}
    </span>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-medium text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-slate-900">
        {value}
      </p>
    </div>
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
    <div className="rounded-xl bg-slate-50 p-6 text-center">
      <p className="font-semibold text-slate-700">
        {title}
      </p>

      <p className="mt-2 text-sm text-slate-500">
        {description}
      </p>
    </div>
  );
}

// =====================================================
// PÁGINA RELATÓRIOS
// =====================================================

export default function Relatorios() {
  const [searchParams, setSearchParams] =
    useSearchParams();

  const [tab, setTab] = useState<Tab>(
    searchParams.has("assessmentId")
      ? "individual"
      : "scans"
  );

  const [scenarios, setScenarios] =
    useState<Scenario[]>([]);

  const [scans, setScans] =
    useState<SavedScan[]>([]);

  const [scenarioId, setScenarioId] = useState(
    searchParams.get("scenarioId") || ""
  );

  const [scanId, setScanId] = useState(
    searchParams.get("scanId") || ""
  );

  const [assessmentId, setAssessmentId] = useState(
    searchParams.get("assessmentId") || ""
  );

  const [scanDetail, setScanDetail] =
    useState<ScanDetail | null>(null);

  const [evaluationHistory, setEvaluationHistory] =
    useState<StoredEvaluation[]>([]);

  const [selectedEvaluation, setSelectedEvaluation] =
    useState<StoredEvaluation | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [loadingScan, setLoadingScan] =
    useState(false);

  const [loadingEvaluations, setLoadingEvaluations] =
    useState(false);

  const [loadingAssessment, setLoadingAssessment] =
    useState(false);

  const [generatingPdf, setGeneratingPdf] =
    useState(false);

  const [error, setError] =
    useState("");

  const [refresh, setRefresh] =
    useState(0);

  // ===================================================
  // RECEBER LINK VINDO DO MONITORAMENTO
  // ===================================================

  useEffect(() => {
    const linkedScan = searchParams.get("scanId");
    const linkedAssessment =
      searchParams.get("assessmentId");
    const linkedScenario =
      searchParams.get("scenarioId");

    if (linkedScan) {
      setTab("scans");
      setScenarioId("");
      setScanId(linkedScan);
      return;
    }

    if (linkedAssessment && linkedScenario) {
      setTab("individual");
      setScenarioId(linkedScenario);
      setAssessmentId(linkedAssessment);
    }
  }, [searchParams]);

  // ===================================================
  // CARREGAMENTO INICIAL
  // ===================================================

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError("");

    void Promise.all([
      api<Scenario[]>(
        "/security/scenarios",
        controller.signal
      ),
      api<SavedScan[]>(
        "/security/scan-reports",
        controller.signal
      ),
    ])
      .then(([scenarioData, scanData]) => {
        if (controller.signal.aborted) return;

        if (
          !Array.isArray(scenarioData) ||
          !Array.isArray(scanData)
        ) {
          throw new Error(
            "A API retornou dados inválidos."
          );
        }

        setScenarios(scenarioData);
        setScans(scanData);

        setScanId((previous) => {
          return previous || scanData[0]?.id || "";
        });
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(errorMessage(err));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [refresh]);

  // ===================================================
  // CARREGAR DETALHES DA VARREDURA
  // ===================================================

  useEffect(() => {
    setScanDetail(null);

    if (tab !== "scans" || !scanId) {
      return;
    }

    const controller = new AbortController();

    setLoadingScan(true);
    setError("");

    void api<ScanDetail>(
      `/security/scan-reports/${scanId}`,
      controller.signal
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setScanDetail(data);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(errorMessage(err));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingScan(false);
        }
      });

    return () => controller.abort();
  }, [tab, scanId, refresh]);

  // ===================================================
  // CARREGAR HISTÓRICO INDIVIDUAL
  // ===================================================

  useEffect(() => {
    setEvaluationHistory([]);
    setSelectedEvaluation(null);

    if (tab !== "individual" || !scenarioId) {
      return;
    }

    const controller = new AbortController();

    setLoadingEvaluations(true);
    setError("");

    void api<StoredEvaluation[]>(
      `/security/scenarios/${scenarioId}/reports`,
      controller.signal
    )
      .then((rows) => {
        if (controller.signal.aborted) return;

        if (!Array.isArray(rows)) {
          throw new Error(
            "O histórico retornado é inválido."
          );
        }

        setEvaluationHistory(rows);

        setAssessmentId((previous) => {
          return previous || rows[0]?.id || "";
        });
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(errorMessage(err));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingEvaluations(false);
        }
      });

    return () => controller.abort();
  }, [tab, scenarioId, refresh]);

  // ===================================================
  // ABRIR AVALIAÇÃO INDIVIDUAL
  // ===================================================

  useEffect(() => {
    setSelectedEvaluation(null);

    if (
      tab !== "individual" ||
      !assessmentId ||
      !scenarioId ||
      loadingEvaluations
    ) {
      return;
    }

    const existing = evaluationHistory.find(
      (item) => item.id === assessmentId
    );

    if (existing) {
      setSelectedEvaluation(existing);
      return;
    }

    // Se a avaliação não estiver entre os últimos
    // 30 registros, busca diretamente pelo ID.
    const controller = new AbortController();

    setLoadingAssessment(true);

    void api<StoredEvaluation>(
      `/security/assessments/${assessmentId}`,
      controller.signal
    )
      .then((data) => {
        if (controller.signal.aborted) return;

        if (
          data.scenario_id &&
          data.scenario_id !== scenarioId
        ) {
          throw new Error(
            "A avaliação pertence a outro cenário."
          );
        }

        setSelectedEvaluation(data);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(
            `Não foi possível abrir a avaliação: ${errorMessage(
              err
            )}`
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingAssessment(false);
        }
      });

    return () => controller.abort();
  }, [
    tab,
    scenarioId,
    assessmentId,
    evaluationHistory,
    loadingEvaluations,
  ]);

  // ===================================================
  // DADOS DERIVADOS
  // ===================================================

  const scenarioNames = new Map(
    scenarios.map((scenario) => [
      scenario.id,
      scenario.name,
    ])
  );

  const filteredScans = scans.filter(
    (scan) =>
      !scenarioId ||
      scan.scenario_id === scenarioId
  );

  const selectedScan =
    tab === "scans" &&
      scanDetail &&
      (!scenarioId ||
        scanDetail.scenario_id === scenarioId)
      ? scanDetail
      : null;

  const operations = selectedScan?.operations || [];

  const checkedOperations = operations.filter(
    (operation) => operation.state === "checked"
  ).length;

  const completedTests = operations.reduce(
    (total, operation) => {
      return (
        total +
        Number(
          operation.sqlInjection?.state === "completed"
        ) +
        Number(operation.xss?.state === "completed")
      );
    },
    0
  );

  const confirmedRoutes = new Set<string>();

  for (const operation of operations) {
    if (
      operation.sqlInjection?.outcome === "confirmed" ||
      operation.xss?.outcome === "confirmed"
    ) {
      confirmedRoutes.add(
        `${operation.method} ${operation.path}`
      );
    }
  }

  // ===================================================
  // NAVEGAÇÃO
  // ===================================================

  function changeTab(next: Tab) {
    setTab(next);
    setError("");
    setSearchParams({});

    if (next === "scans") {
      setScenarioId("");
      setScanId(scans[0]?.id || "");
      return;
    }

    setScenarioId(
      (previous) =>
        previous || scenarios[0]?.id || ""
    );

    setAssessmentId("");
  }

  function changeScenario(id: string) {
    setScenarioId(id);
    setError("");
    setSearchParams({});

    if (tab === "scans") {
      const first = scans.find(
        (scan) =>
          !id ||
          scan.scenario_id === id
      );

      setScanId(first?.id || "");
    } else {
      setAssessmentId("");
      setSelectedEvaluation(null);
    }
  }

  function openAssessment(
    id: string,
    targetScenarioId: string
  ) {
    setTab("individual");
    setScenarioId(targetScenarioId);
    setAssessmentId(id);

    setSearchParams({
      scenarioId: targetScenarioId,
      assessmentId: id,
    });
  }

  // ===================================================
  // GERAR PDF DE VARREDURA COMPLETA
  // ===================================================

  async function downloadScanPdf() {
    if (
      !selectedScan ||
      selectedScan.status !== "completed"
    ) {
      return;
    }

    setGeneratingPdf(true);
    setError("");

    try {
      const scenarioName =
        scenarioNames.get(selectedScan.scenario_id) ||
        "Cenário";

      await baixarPdfVarreduraDetalhado(
        {
          id: selectedScan.id,
          scenario_id: selectedScan.scenario_id,
          status: selectedScan.status,
          started_at: selectedScan.started_at,
          finished_at: selectedScan.finished_at,
          total: selectedScan.total,
          completed: selectedScan.completed,
          operations: selectedScan.operations,
          error: selectedScan.error,
        },
        scenarioName
      );
    } catch (err) {
      setError(
        `Erro ao gerar o PDF: ${errorMessage(err)}`
      );
    } finally {
      setGeneratingPdf(false);
    }
  }

  // ===================================================
  // GERAR PDF DE AVALIAÇÃO INDIVIDUAL
  // ===================================================

  async function downloadAssessmentPdf() {
    if (!selectedEvaluation?.report) return;

    setGeneratingPdf(true);
    setError("");

    try {
      const scenarioName =
        scenarioNames.get(scenarioId) ||
        "Cenário";

      await baixarPdfAvaliacaoDetalhado(
        selectedEvaluation.report,
        scenarioName
      );
    } catch (err) {
      setError(
        `Erro ao gerar o PDF: ${errorMessage(err)}`
      );
    } finally {
      setGeneratingPdf(false);
    }
  }

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
            Relatórios de segurança
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Consulte os resultados das varreduras,
            analise as evidências e gere relatórios
            técnicos em PDF.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setRefresh((value) => value + 1)
            }
            disabled={loading}
            className={secondaryButton}
          >
            Atualizar
          </button>

          <Link
            to="/monitoramento"
            className={primaryButton}
          >
            Monitoramento
          </Link>
        </div>
      </header>

      {/* SELEÇÃO DO TIPO DE RELATÓRIO */}

      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => changeTab("scans")}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === "scans"
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
          >
            Varreduras completas
          </button>

          <button
            type="button"
            onClick={() => changeTab("individual")}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === "individual"
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
          >
            Avaliações individuais
          </button>
        </div>

        {/* FILTRO DE CENÁRIO */}

        <label className="block text-sm font-medium text-slate-700">
          Cenário

          <select
            className={`${selectClass} mt-2`}
            value={scenarioId}
            onChange={(event) =>
              changeScenario(event.target.value)
            }
          >
            {tab === "scans" && (
              <option value="">
                Todos os cenários
              </option>
            )}

            {tab === "individual" &&
              !scenarioId && (
                <option value="">
                  Selecione um cenário
                </option>
              )}

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

        {/* FILTRO DE VARREDURA */}

        {tab === "scans" && (
          <label className="block text-sm font-medium text-slate-700">
            Varredura

            <select
              className={`${selectClass} mt-2`}
              value={
                filteredScans.some(
                  (scan) => scan.id === scanId
                )
                  ? scanId
                  : ""
              }
              onChange={(event) => {
                setScanId(event.target.value);
                setSearchParams({});
              }}
            >
              <option value="">
                Selecione uma varredura
              </option>

              {filteredScans.map((scan) => (
                <option
                  key={scan.id}
                  value={scan.id}
                >
                  {formatDate(scan.started_at)}
                  {" — "}
                  {scenarioNames.get(
                    scan.scenario_id
                  ) || "Cenário"}
                  {" — "}
                  {scan.total} operações
                </option>
              ))}
            </select>
          </label>
        )}
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

      {(loading ||
        loadingScan ||
        loadingEvaluations ||
        loadingAssessment) && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Carregando informações dos relatórios...
          </div>
        )}

      {/* =================================================
          RELATÓRIO DE VARREDURA COMPLETA
      ================================================= */}

      {tab === "scans" &&
        !loading &&
        !loadingScan &&
        !selectedScan &&
        !error && (
          <EmptyState
            title="Nenhuma varredura selecionada"
            description="Execute uma análise no Monitoramento ou selecione uma varredura salva."
          />
        )}

      {tab === "scans" &&
        selectedScan &&
        !loadingScan && (
          <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {/* IDENTIFICAÇÃO */}

            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                  Relatório de varredura
                </p>

                <h2 className="mt-2 text-xl font-bold text-slate-900">
                  {scenarioNames.get(
                    selectedScan.scenario_id
                  ) || "Cenário"}
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Início:{" "}
                  {formatDate(
                    selectedScan.started_at
                  )}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Término:{" "}
                  {formatDate(
                    selectedScan.finished_at
                  )}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Status:{" "}
                  <span className="font-medium text-slate-700">
                    {selectedScan.status === "completed"
                      ? "Concluída"
                      : "Interrompida"}
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  void downloadScanPdf()
                }
                disabled={
                  generatingPdf ||
                  selectedScan.status !== "completed"
                }
                className={primaryButton}
              >
                {generatingPdf
                  ? "Gerando relatório..."
                  : "Baixar relatório técnico PDF"}
              </button>
            </div>

            {/* RESUMO */}

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <SummaryCard
                label="Operações descobertas"
                value={selectedScan.total}
              />

              <SummaryCard
                label="HTTP verificado"
                value={checkedOperations}
              />

              <SummaryCard
                label="Testes SQLi/XSS concluídos"
                value={completedTests}
              />

              <SummaryCard
                label="Rotas com falha demonstrada"
                value={confirmedRoutes.size}
              />
            </div>

            <p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              O relatório apresenta as operações
              descobertas, os testes realizados e
              as limitações de cobertura. Uma rota
              sem vulnerabilidade demonstrada não
              deve ser considerada automaticamente
              segura.
            </p>

            {/* TABELA DAS OPERAÇÕES */}

            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Operações analisadas
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Clique em detalhes para consultar
                os resultados de cada rota.
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">
                      Operação
                    </th>

                    <th className="px-4 py-3">
                      HTTP
                    </th>

                    <th className="px-4 py-3">
                      SQL Injection
                    </th>

                    <th className="px-4 py-3">
                      XSS
                    </th>

                    <th className="px-4 py-3">
                      Detalhes
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {operations.map(
                    (operation, index) => (
                      <tr
                        key={`${index}-${operation.method}-${operation.path}`}
                        className="align-top hover:bg-slate-50"
                      >
                        <td className="px-4 py-4">
                          <p className="break-all font-mono text-xs font-semibold text-slate-800">
                            {operation.method}{" "}
                            {operation.path}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {operation.summary}
                          </p>
                        </td>

                        <td className="px-4 py-4 text-xs text-slate-700">
                          {operation.httpStatus === null
                            ? "Não requisitada"
                            : `HTTP ${operation.httpStatus}`}
                        </td>

                        <td className="px-4 py-4 text-xs">
                          <span
                            className={
                              operation.sqlInjection?.outcome ===
                                "confirmed"
                                ? "font-semibold text-red-700"
                                : "text-slate-600"
                            }
                          >
                            {testLabel(
                              operation.sqlInjection
                            )}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-xs">
                          <span
                            className={
                              operation.xss?.outcome ===
                                "confirmed"
                                ? "font-semibold text-red-700"
                                : "text-slate-600"
                            }
                          >
                            {testLabel(operation.xss)}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <details className="max-w-sm text-xs">
                            <summary className="cursor-pointer font-semibold text-blue-700">
                              Ver detalhes
                            </summary>

                            <div className="mt-3 space-y-3 rounded-lg bg-slate-100 p-3 text-slate-600">
                              <p>
                                {operation.explanation}
                              </p>

                              <p>
                                <b>SQLi:</b>{" "}
                                {operation.sqlInjection
                                  ?.reason ||
                                  testLabel(
                                    operation.sqlInjection
                                  )}
                              </p>

                              <p>
                                <b>XSS:</b>{" "}
                                {operation.xss?.reason ||
                                  testLabel(operation.xss)}
                              </p>

                              {operation.sqlInjection?.reportId && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    openAssessment(
                                      operation.sqlInjection.reportId!,
                                      selectedScan.scenario_id
                                    )
                                  }
                                  className="block text-left font-semibold text-blue-700 underline"
                                >
                                  Ver tentativas e evidências SQLi
                                </button>
                              )}

                              {operation.xss?.reportId && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    openAssessment(
                                      operation.xss.reportId!,
                                      selectedScan.scenario_id
                                    )
                                  }
                                  className="block text-left font-semibold text-blue-700 underline"
                                >
                                  Ver tentativas e evidências XSS
                                </button>
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

            {/* ERRO DA VARREDURA */}

            {selectedScan.status === "failed" && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                A varredura foi interrompida:{" "}
                {selectedScan.error ||
                  "Motivo não informado."}
              </div>
            )}
          </section>
        )}

      {/* =================================================
          RELATÓRIOS INDIVIDUAIS
      ================================================= */}

      {tab === "individual" &&
        !loading &&
        !loadingEvaluations && (
          <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Avaliações individuais
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Consulte as avaliações SQL Injection
                e XSS registradas no cenário.
              </p>
            </div>

            {/* HISTÓRICO */}

            {evaluationHistory.length === 0 ? (
              <EmptyState
                title="Nenhuma avaliação no histórico recente"
                description="Execute testes no Monitoramento para gerar registros."
              />
            ) : (
              <div className="space-y-2">
                {evaluationHistory.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => {
                      setAssessmentId(entry.id);
                      setError("");
                      setSearchParams({});
                    }}
                    className={`flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-left text-sm transition hover:bg-slate-50 ${assessmentId === entry.id
                        ? "border-blue-400 bg-blue-50/30"
                        : "border-slate-200"
                      }`}
                  >
                    <div>
                      <p className="font-semibold text-slate-800">
                        {entry.report?.attackType ||
                          "Teste"}
                        {" · "}
                        {entry.report?.route?.method}{" "}
                        {entry.report?.route?.path}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {formatDate(entry.created_at)}
                      </p>
                    </div>

                    <OutcomeBadge
                      outcome={
                        entry.outcome ||
                        entry.report?.outcome
                      }
                    />
                  </button>
                ))}
              </div>
            )}

            {/* RELATÓRIO SELECIONADO */}

            {selectedEvaluation?.report && (
              <div className="space-y-5 border-t border-slate-200 pt-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                      Detalhamento técnico
                    </p>

                    <h3 className="mt-2 text-lg font-bold text-slate-900">
                      {selectedEvaluation.report.attackType}
                      {" · "}
                      {selectedEvaluation.report.route.method}
                      {" "}
                      {selectedEvaluation.report.route.path}
                    </h3>

                    <p className="mt-2 text-xs text-slate-500">
                      {formatDate(
                        selectedEvaluation.created_at
                      )}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void downloadAssessmentPdf()
                    }
                    disabled={generatingPdf}
                    className={primaryButton}
                  >
                    {generatingPdf
                      ? "Gerando relatório..."
                      : "Baixar relatório técnico PDF"}
                  </button>
                </div>

                {/* CLASSIFICAÇÃO */}

                <div className="flex flex-wrap items-center gap-3">
                  <OutcomeBadge
                    outcome={
                      selectedEvaluation.report.outcome
                    }
                  />

                  <span className="text-sm text-slate-600">
                    Campo analisado:{" "}
                    <b>
                      {selectedEvaluation.report.field}
                    </b>
                  </span>
                </div>

                <p className="text-sm leading-6 text-slate-600">
                  {
                    selectedEvaluation.report.explanation
                  }
                </p>

                {/* RESUMO DA AVALIAÇÃO */}

                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <SummaryCard
                    label="Requisições enviadas"
                    value={
                      selectedEvaluation.report.sentRequests
                    }
                  />

                  <SummaryCard
                    label="Tentativas avaliadas"
                    value={
                      selectedEvaluation.report.executedProbes
                    }
                  />

                  <SummaryCard
                    label="Falhas demonstradas"
                    value={
                      (
                        selectedEvaluation.report.results ||
                        []
                      ).filter(
                        (attempt) =>
                          attempt.outcome === "confirmed"
                      ).length
                    }
                  />
                </div>

                {/* TENTATIVAS EXECUTADAS */}

                <div className="space-y-3">
                  <h4 className="text-base font-bold text-slate-900">
                    Tentativas e evidências
                  </h4>

                  {(
                    selectedEvaluation.report.results || []
                  ).length === 0 && (
                      <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                        Não foram registradas tentativas
                        detalhadas nesta avaliação.
                      </p>
                    )}

                  {(
                    selectedEvaluation.report.results || []
                  ).map((attempt, index) => (
                    <details
                      key={`${index}-${attempt.name}`}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                        <span className="font-semibold text-slate-800">
                          {index + 1}. {attempt.name}
                        </span>

                        <OutcomeBadge
                          outcome={attempt.outcome}
                        />
                      </summary>

                      <div className="mt-5 space-y-4 border-t border-slate-100 pt-4">
                        {/* PAYLOAD */}

                        <div>
                          <p className="text-xs font-semibold text-slate-700">
                            Payload utilizado
                          </p>

                          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-slate-100 p-4 font-mono text-xs text-slate-800">
                            {attempt.payload}
                          </pre>
                        </div>

                        {/* RESPOSTAS HTTP */}

                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                          <div className="rounded-lg bg-slate-50 p-3">
                            <p className="text-xs text-slate-500">
                              HTTP de controle
                            </p>

                            <p className="mt-1 font-semibold text-slate-800">
                              {attempt.falseCondition?.status ??
                                "Não aplicável"}
                            </p>
                          </div>

                          <div className="rounded-lg bg-slate-50 p-3">
                            <p className="text-xs text-slate-500">
                              HTTP do teste
                            </p>

                            <p className="mt-1 font-semibold text-slate-800">
                              {attempt.testResponse?.status ??
                                "Sem resposta"}
                            </p>
                          </div>

                          <div className="rounded-lg bg-slate-50 p-3">
                            <p className="text-xs text-slate-500">
                              Duração da resposta
                            </p>

                            <p className="mt-1 font-semibold text-slate-800">
                              {attempt.testResponse
                                ?.durationMs !== undefined
                                ? `${attempt.testResponse.durationMs} ms`
                                : "Não informado"}
                            </p>
                          </div>
                        </div>

                        {/* OUTRAS EVIDÊNCIAS */}

                        <div className="space-y-2 text-sm text-slate-600">
                          <p>
                            <b>Payload refletido:</b>{" "}
                            {attempt.testResponse
                              ?.payload_reflected
                              ? "Sim"
                              : "Não"}
                          </p>

                          <p>
                            <b>JavaScript executado:</b>{" "}
                            {attempt.browser?.executed
                              ? "Comprovado"
                              : attempt.browser?.checked
                                ? "Não comprovado"
                                : "Verificação não realizada"}
                          </p>

                          <p>
                            <b>Classificação ML:</b>{" "}
                            {attempt.ml?.attack
                              ?.classification ||
                              "Indisponível"}
                          </p>

                          {attempt.testResponse?.body_digest && (
                            <p className="break-all">
                              <b>Hash da resposta:</b>{" "}
                              {
                                attempt.testResponse.body_digest
                              }
                            </p>
                          )}

                          {attempt.testResponse?.error && (
                            <p className="text-red-700">
                              <b>Erro HTTP:</b>{" "}
                              {
                                attempt.testResponse.error
                              }
                            </p>
                          )}

                          {attempt.ml_error && (
                            <p className="text-amber-700">
                              <b>Limitação do ML:</b>{" "}
                              {attempt.ml_error}
                            </p>
                          )}
                        </div>

                        {/* EXPLICAÇÃO */}

                        <div className="rounded-xl bg-slate-50 p-4">
                          <p className="text-sm font-semibold text-slate-800">
                            Interpretação do resultado
                          </p>

                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {attempt.explanation}
                          </p>
                        </div>

                        {/* SOLUÇÕES DA TENTATIVA */}

                        {attempt.recommendations?.length ? (
                          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                            <p className="text-sm font-semibold text-blue-900">
                              Recomendações
                            </p>

                            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-blue-900">
                              {attempt.recommendations.map(
                                (recommendation, i) => (
                                  <li key={i}>
                                    {recommendation}
                                  </li>
                                )
                              )}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    </details>
                  ))}
                </div>

                {/* RECOMENDAÇÕES GERAIS */}

                {(selectedEvaluation.report.recommendations?.length ?? 0) > 0 && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
                    <h4 className="font-bold text-blue-900">
                      Possíveis soluções
                    </h4>

                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-blue-900">
                      {selectedEvaluation.report.recommendations?.map(
                        (recommendation, index) => (
                          <li key={index}>
                            {recommendation}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )}

              </div>
            )}
          </section>
        )}
    </main>
  );
}
