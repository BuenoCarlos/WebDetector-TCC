import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import {
  baixarPdfVarreduraDetalhado,
} from "../../services/pdfReportService";

const API = (
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:4000/api"
).replace(/\/$/, "");

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500";

type Scenario = {
  id: string;
  name: string;
  base_url: string;
};

type AuthProfile = {
  id: string;
  description: string;
};

type LoginInput = {
  username: string;
  password: string;
};

type Test = {
  state: string;
  reason?: string;
  outcome?: string;
  reportId?: string;
  field?: string;
};

type ScanRow = {
  method: string;
  path: string;
  summary: string;
  inputs: {
    path: string[];
    query: string[];
    body: string[];
  };
  needsAuth: boolean;
  authProfile?: string;
  state: string;
  httpStatus: number | null;
  durationMs: number | null;
  explanation: string;
  sqlInjection: Test;
  xss: Test;
};

type ScanJob = {
  id: string;
  status: "running" | "completed" | "failed";
  total: number;
  completed: number;
  operations: ScanRow[];
  startedAt: string;
  finishedAt?: string;
  authResults: Array<{
    profile: string;
    state: string;
    httpStatus: number | null;
    reason: string;
  }>;
  error?: string;
  saved?: boolean;
  saveError?: string;
};

async function api<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(
    `${API}${url}`,
    {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    }
  );

  const result = await response.json().catch(
    () => ({
      error: "Resposta inválida da API.",
    })
  );

  if (!response.ok) {
    throw new Error(
      result.error ||
      `HTTP ${response.status}`
    );
  }

  return result as T;
}

const outcomeNames: Record<string, string> = {
  confirmed: "Vulnerabilidade demonstrada",
  suspected: "Indícios — requer validação",
  not_confirmed: "Não demonstrada neste teste",
  inconclusive: "Inconclusivo",
};

function checkText(value: Test): string {
  if (value.state === "completed") {
    return (
      outcomeNames[value.outcome || ""] ||
      value.outcome ||
      "Concluído"
    );
  }

  const labels: Record<string, string> = {
    not_applicable: "Não aplicável",
    not_supported_yet: "Ainda não suportado",
    skipped: "Não executado",
    error: "Falha no teste",
    pending: "Em andamento",
  };

  return labels[value.state] || value.state;
}

function Status({
  status,
}: {
  status: string;
}) {
  const styles: Record<string, string> = {
    checked: "bg-emerald-50 text-emerald-800",
    auth_required: "bg-amber-50 text-amber-800",
    error: "bg-red-50 text-red-800",
  };

  const labels: Record<string, string> = {
    checked: "HTTP verificado",
    auth_required: "Autenticação/Permissão pendente",
    error: "Erro",
    skipped: "Não executada",
    blocked: "Bloqueada",
    pending: "Aguardando",
  };

  return (
    <span
      className={`inline-flex rounded px-2 py-1 text-xs font-medium ${styles[status] ||
        "bg-slate-100 text-slate-700"
        }`}
    >
      {labels[status] || status}
    </span>
  );
}

export default function ApplicationScanPanel() {
  const [scenarios, setScenarios] =
    useState<Scenario[]>([]);

  const [scenarioId, setScenarioId] =
    useState("");

  const [profiles, setProfiles] =
    useState<AuthProfile[]>([]);

  const [credentials, setCredentials] =
    useState<Record<string, LoginInput>>({});

  const [loadingProfiles, setLoadingProfiles] =
    useState(false);

  const [job, setJob] =
    useState<ScanJob | null>(null);

  const [error, setError] =
    useState("");

  const [starting, setStarting] =
    useState(false);

  const pdfGerados = useRef<Set<string>>(new Set());
  const [gerandoPdf, setGerandoPdf] = useState(false);


  async function exportarRelatorioPdf() {
    if (!job || job.status !== "completed") {
      return;
    }

    const scenarioName =
      scenarios.find(
        (scenario) => scenario.id === scenarioId
      )?.name || "Cenário";

    setGerandoPdf(true);

    try {
      await baixarPdfVarreduraDetalhado(
        {
          ...job,
          scenarioId,
        },
        scenarioName
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o PDF."
      );
    } finally {
      setGerandoPdf(false);
    }
  }

  // Gerar automaticamente quando a varredura terminar.
  useEffect(() => {
    if (
      job?.status !== "completed" ||
      pdfGerados.current.has(job.id)
    ) {
      return;
    }

    pdfGerados.current.add(job.id);

    void exportarRelatorioPdf();
  }, [job, scenarios, scenarioId]);

  useEffect(() => {
    void api<Scenario[]>("/security/scenarios")
      .then((data) => {
        setScenarios(data);

        if (data.length > 0) {
          setScenarioId(data[0].id);
        }
      })
      .catch((err) => {
        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível carregar os cenários."
        );
      });
  }, []);

  useEffect(() => {
    setProfiles([]);
    setCredentials({});

    if (!scenarioId) return;

    let active = true;

    setLoadingProfiles(true);

    void api<AuthProfile[]>(
      `/security/scenarios/${scenarioId}/scan-profiles`
    )
      .then((data) => {
        if (active) {
          setProfiles(data);
        }
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Erro ao carregar perfis de autenticação."
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoadingProfiles(false);
        }
      });

    return () => {
      active = false;
    };
  }, [scenarioId]);

  useEffect(() => {
    if (
      !job?.id ||
      job.status !== "running"
    ) {
      return;
    }

    let active = true;
    let polling = false;

    const intervalId = setInterval(() => {
      if (!active || polling) return;

      polling = true;

      void api<ScanJob>(
        `/security/scans/${job.id}`
      )
        .then((next) => {
          if (active) {
            setJob(next);
          }
        })
        .catch((err) => {
          if (active) {
            setError(
              err instanceof Error
                ? err.message
                : "Falha no acompanhamento."
            );
          }
        })
        .finally(() => {
          polling = false;
        });
    }, 1200);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [job?.id, job?.status]);

  async function start() {
    if (!scenarioId) return;

    setStarting(true);
    setJob(null);
    setError("");

    try {
      const authProfiles: Record<
        string,
        LoginInput
      > = {};

      for (
        const [id, values] of Object.entries(
          credentials
        )
      ) {
        if (
          values.username.trim() &&
          values.password
        ) {
          authProfiles[id] = {
            username: values.username.trim(),
            password: values.password,
          };
        }
      }

      const created = await api<ScanJob>(
        `/security/scenarios/${scenarioId}/scan`,
        {
          method: "POST",
          body: JSON.stringify({
            includeMutations: false,
            includeSecurityTests: true,
            authProfiles,
          }),
        }
      );

      setJob(created);

      // Limpa os campos de senha depois do início.
      setCredentials({});
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível iniciar a varredura."
      );
    } finally {
      setStarting(false);
    }
  }

  const completed = job?.completed ?? 0;

  const progress = job?.total
    ? Math.floor(
      (100 * completed) / job.total
    )
    : 0;

  const issues =
    job?.operations.filter(
      (r) =>
        r.sqlInjection.outcome === "confirmed" ||
        r.xss.outcome === "confirmed"
    ) || [];

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header>
        <h2 className="text-xl font-bold text-slate-900">
          Varredura completa da aplicação
        </h2>

        <p className="mt-2 text-sm text-slate-600">
          Descobre as operações do OpenAPI,
          verifica as respostas HTTP e executa
          SQLi/XSS quando compatível.
          Rotas sem entrada continuam no relatório.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">
          Cenário

          <select
            className={`${inputClass} mt-2`}
            value={scenarioId}
            disabled={job?.status === "running"}
            onChange={(e) => {
              setScenarioId(e.target.value);
              setJob(null);
            }}
          >
            <option value="">
              Selecione
            </option>

            {scenarios.map((scenario) => (
              <option
                key={scenario.id}
                value={scenario.id}
              >
                {scenario.name} — {scenario.base_url}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-3 rounded-xl border border-slate-200 p-4 md:col-span-2">
          <h3 className="text-sm font-semibold text-slate-800">
            Autenticação de contas de teste
          </h3>

          <p className="text-xs text-slate-600">
            Os perfis são identificados pelo OpenAPI.
            Informe contas fictícias para verificar
            rotas protegidas. As senhas não são
            incluídas no relatório.
          </p>

          {loadingProfiles && (
            <p className="text-xs text-slate-500">
              Lendo os perfis de autenticação...
            </p>
          )}

          {!loadingProfiles &&
            profiles.length === 0 && (
              <p className="text-xs text-amber-700">
                Nenhum perfil declarado no OpenAPI.
                Rotas que exigem sessão poderão
                ficar sem avaliação.
              </p>
            )}

          <div className="grid gap-4 md:grid-cols-2">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="space-y-2 rounded-lg bg-slate-50 p-3"
              >
                <p className="text-sm font-medium text-slate-800">
                  {profile.description}
                </p>

                <label className="block text-xs text-slate-600">
                  Usuário de teste

                  <input
                    className={`${inputClass} mt-1`}
                    value={
                      credentials[profile.id]
                        ?.username ?? ""
                    }
                    autoComplete="off"
                    placeholder="Usuário fictício"
                    disabled={job?.status === "running"}
                    onChange={(e) =>
                      setCredentials((prev) => ({
                        ...prev,
                        [profile.id]: {
                          username: e.target.value,
                          password:
                            prev[profile.id]?.password ??
                            "",
                        },
                      }))
                    }
                  />
                </label>

                <label className="block text-xs text-slate-600">
                  Senha de teste

                  <input
                    className={`${inputClass} mt-1`}
                    type="password"
                    autoComplete="new-password"
                    value={
                      credentials[profile.id]
                        ?.password ?? ""
                    }
                    placeholder="Senha fictícia"
                    disabled={job?.status === "running"}
                    onChange={(e) =>
                      setCredentials((prev) => ({
                        ...prev,
                        [profile.id]: {
                          username:
                            prev[profile.id]?.username ??
                            "",
                          password: e.target.value,
                        },
                      }))
                    }
                  />
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        A autenticação ocorre no Node contra a
        aplicação local documentada no OpenAPI.
        Operações não executadas
        exibem o motivo.
      </p>

      <button
        type="button"
        disabled={
          !scenarioId ||
          starting ||
          job?.status === "running"
        }
        onClick={() => void start()}
        className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {starting || job?.status === "running"
          ? "Analisando operações..."
          : "Analisar todas as rotas"}
      </button>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      {job && (
        <div className="space-y-4">
          {job.authResults?.length > 0 && (
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-semibold">
                Sessões de teste
              </p>

              {job.authResults.map((item) => (
                <p
                  key={item.profile}
                  className="text-xs text-slate-600"
                >
                  <b>{item.profile}:</b>{" "}
                  {item.state === "authenticated"
                    ? "Autenticado"
                    : item.state === "missing_credentials"
                      ? "Credenciais não informadas"
                      : "Falha no login"}
                  {" — "}
                  {item.reason}
                </p>
              ))}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">
                Operações encontradas
              </p>

              <p className="text-2xl font-bold">
                {job.total}
              </p>
            </div>

            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">
                Processadas (inclui não testadas)
              </p>

              <p className="text-2xl font-bold">
                {completed}
              </p>
            </div>

            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">
                Operações com falha demonstrada
              </p>

              <p className="text-2xl font-bold text-red-700">
                {issues.length}
              </p>
            </div>
          </div>

          <div className="h-2 overflow-hidden rounded bg-slate-100">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="text-xs text-slate-500">
            {job.status === "running"
              ? `Processando ${completed} de ${job.total} operações (${progress}%).`
              : job.status === "failed"
                ? job.error
                : "Varredura concluída."}
          </p>



          {job.status === "completed" && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-lg font-bold text-slate-900">
                Varredura concluída
              </h3>

              <p className="mt-2 text-sm text-slate-600">
                A análise foi finalizada. Você pode baixar
                o relatório técnico em PDF ou visualizar
                os resultados na aba Relatórios.
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                
<button
  type="button"
  onClick={() => void exportarRelatorioPdf()}
  disabled={gerandoPdf}
  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
>
  {gerandoPdf
    ? "Preparando relatório detalhado..."
    : "Baixar relatório técnico em PDF"}
</button>


                {job.saved && (
                  <Link
                    to={`/relatorios?scanId=${job.id}`}
                    className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Ver relatório completo
                  </Link>
                )}
              </div>
            </div>
          )}


          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-3">Operação</th>
                  <th className="p-3">HTTP</th>
                  <th className="p-3">SQL Injection</th>
                  <th className="p-3">XSS</th>
                  <th className="p-3">Detalhes</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {job.operations.map((row, index) => (
                  <tr
                    key={`${index}-${row.method}-${row.path}`}
                    className="align-top"
                  >
                    <td className="p-3">
                      <div className="font-medium">
                        {row.method} {row.path}
                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        {row.summary}
                      </p>
                    </td>

                    <td className="space-y-1 p-3">
                      <Status status={row.state} />

                      <p className="text-xs text-slate-500">
                        {row.httpStatus !== null
                          ? `HTTP ${row.httpStatus}`
                          : "—"}
                      </p>
                    </td>

                    <td className="p-3 text-xs">
                      {checkText(row.sqlInjection)}

                      {row.sqlInjection.field && (
                        <p className="mt-1 text-slate-500">
                          Campo: {row.sqlInjection.field}
                        </p>
                      )}
                    </td>

                    <td className="p-3 text-xs">
                      {checkText(row.xss)}

                      {row.xss.field && (
                        <p className="mt-1 text-slate-500">
                          Campo: {row.xss.field}
                        </p>
                      )}
                    </td>

                    <td className="p-3">
                      <details className="max-w-sm text-xs">
                        <summary className="cursor-pointer text-blue-700">
                          Ver detalhes
                        </summary>

                        <div className="mt-2 space-y-2 break-words rounded bg-slate-50 p-3">
                          <p>{row.explanation}</p>

                          <p>
                            Autenticação:{" "}
                            {row.needsAuth
                              ? row.authProfile
                                ? `perfil ${row.authProfile}`
                                : "perfil não documentado"
                              : "pública"}
                          </p>

                          <p>
                            Entradas: caminho [
                            {row.inputs.path.join(", ") || "—"}
                            ], query [
                            {row.inputs.query.join(", ") || "—"}
                            ], JSON [
                            {row.inputs.body.join(", ") || "—"}
                            ]
                          </p>

                          {(row.sqlInjection.field ||
                            row.xss.field) && (
                              <p>
                                Esta versão testa somente o
                                primeiro campo textual
                                compatível da operação.
                              </p>
                            )}

                          {row.sqlInjection.reason && (
                            <p>
                              SQLi: {row.sqlInjection.reason}
                            </p>
                          )}

                          {row.xss.reason && (
                            <p>
                              XSS: {row.xss.reason}
                            </p>
                          )}

                          {row.sqlInjection.reportId && (
                            <p>
                              Relatório SQLi:{" "}
                              {row.sqlInjection.reportId}
                            </p>
                          )}

                          {row.xss.reportId && (
                            <p>
                              Relatório XSS:{" "}
                              {row.xss.reportId}
                            </p>
                          )}
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {job.status === "completed" && (
            <p className="text-xs text-slate-500">
              Os relatórios individuais SQLi/XSS são
              salvos em webdetector_assessments.
              O resumo da varredura fica em memória
              até reiniciar o Node.
            </p>
          )}
        </div>
      )}
    </section>
  );
}