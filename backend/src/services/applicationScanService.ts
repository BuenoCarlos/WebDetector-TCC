import { randomUUID } from "node:crypto";
import { supabase } from "../config/supabase";
import {
  SecurityEvaluationService,
  type EvaluationAuth,
} from "./securityEvaluationService";

type JsonObject = Record<string, unknown>;
type Verb = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type AttackType = "SQLI" | "XSS";

type ItemState =
  | "pending"
  | "checked"
  | "auth_required"
  | "blocked"
  | "error"
  | "skipped";

type TestState =
  | "not_applicable"
  | "not_supported_yet"
  | "pending"
  | "completed"
  | "skipped"
  | "error";

type TestResult = {
  state: TestState;
  reason?: string;
  outcome?: string;
  reportId?: string;
  field?: string;
};

export type ScannedOperation = {
  method: Verb;
  path: string;
  summary: string;
  inputs: {
    path: string[];
    query: string[];
    body: string[];
  };
  needsAuth: boolean;
  authProfile?: string;
  state: ItemState;
  httpStatus: number | null;
  durationMs: number | null;
  explanation: string;
  sqlInjection: TestResult;
  xss: TestResult;
};

export type ScanJob = {
  id: string;
  scenarioId: string;
  status: "running" | "completed" | "failed";
  startedAt: string;
  finishedAt?: string;
  total: number;
  completed: number;
  operations: ScannedOperation[];
  saved?: boolean;
  saveError?: string;
  authResults: Array<{
    profile: string;
    state:
    | "authenticated"
    | "missing_credentials"
    | "login_failed";
    httpStatus: number | null;
    reason: string;
  }>;
  error?: string;
};

export type ScanOptions = {
  includeMutations: boolean;
  includeSecurityTests: boolean;
  authProfiles?: Record<
    string,
    { username: string; password: string }
  >;
};

export type AuthProfileInfo = {
  id: string;
  description: string;
};

type AuthProfileSpec = {
  description: string;
  loginPath: string;
  usernameField: string;
  passwordField: string;
  cookieName?: string;
  tokenField?: string;
};

type PlannedOperation = {
  op: JsonObject;
  method: Verb;
  template: string;
  urlPath: string | null;
  query: Record<string, string>;
  body: Record<string, string | number | boolean>;
  inputs: ScannedOperation["inputs"];
  needsAuth: boolean;
  authorized: boolean;
  eligibleForOldExecutor: boolean;
  authProfile?: string;
  scanSafe: boolean;
  reasonIfUnresolved?: string;
};

const JOBS = new Map<string, ScanJob>();
const MAX_JOBS = 15;
const METHODS: Verb[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
];

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function object(value: unknown): JsonObject {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function localOrigin(value: string): URL {
  const url = new URL(value);

  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    !url.port ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error(
      "Somente aplicações HTTP locais, com porta explícita, são aceitas."
    );
  }

  return url;
}

function resolve(doc: JsonObject, value: unknown): JsonObject {
  let current = object(value);

  for (let i = 0; i < 5; i++) {
    const ref = current.$ref;

    if (typeof ref !== "string" || !ref.startsWith("#/")) {
      return current;
    }

    let target: unknown = doc;

    for (const segment of ref.slice(2).split("/")) {
      target =
        object(target)[
        segment.replace(/~1/g, "/").replace(/~0/g, "~")
        ];
    }

    current = object(target);
  }

  return {};
}

async function specFor(base: URL): Promise<JsonObject> {
  for (const name of [
    "openapi.json",
    "swagger.json",
    "api-docs.json",
    "api/openapi.json",
  ]) {
    try {
      const response = await fetch(new URL("/" + name, base), {
        redirect: "error",
        signal: AbortSignal.timeout(3500),
      });

      if (!response.ok) continue;

      const raw: unknown = await response.json();

      if (
        object(raw).paths &&
        typeof object(raw).paths === "object"
      ) {
        return object(raw);
      }
    } catch {
      // Tentar o próximo caminho do OpenAPI.
    }
  }

  throw new Error(
    "OpenAPI não encontrado na URL local informada."
  );
}

function example(
  schemaRaw: unknown,
  doc: JsonObject,
  fallback: string
): string | number | boolean {
  const schema = resolve(doc, schemaRaw);

  const pick =
    schema.example ??
    schema.default ??
    (Array.isArray(schema.enum)
      ? schema.enum[0]
      : undefined);

  if (
    ["string", "number", "boolean"].includes(typeof pick)
  ) {
    return pick as string | number | boolean;
  }

  if (
    schema.type === "integer" ||
    schema.type === "number"
  ) {
    return 1;
  }

  if (schema.type === "boolean") return false;
  if (schema.format === "email") return "teste@example.test";

  return fallback;
}

function plan(
  doc: JsonObject,
  template: string,
  method: Verb,
  def: JsonObject,
  pathDef: JsonObject
): PlannedOperation {
  const params = [
    ...(Array.isArray(pathDef.parameters)
      ? pathDef.parameters
      : []),
    ...(Array.isArray(def.parameters)
      ? def.parameters
      : []),
  ].map((p) => resolve(doc, p));

  const body: Record<
    string,
    string | number | boolean
  > = {};

  const query: Record<string, string> = {};

  const fields = {
    path: [] as string[],
    query: [] as string[],
    body: [] as string[],
  };

  const baseline = object(
    object(def["x-webdetector-test"]).baseline
  );

  let urlPath = template;
  let reasonIfUnresolved: string | undefined;

  for (const p of params) {
    const name =
      typeof p.name === "string" ? p.name : "";

    if (!name) continue;

    const schema = resolve(doc, p.schema);

    const val =
      baseline[name] ??
      p.example ??
      schema.example ??
      schema.default;

    if (p.in === "path") {
      fields.path.push(name);

      if (
        val === undefined ||
        !["string", "number"].includes(typeof val)
      ) {
        reasonIfUnresolved =
          `Informe um exemplo de parâmetro de caminho para ${name} no OpenAPI.`;
        continue;
      }

      urlPath = urlPath.replace(
        `{${name}}`,
        encodeURIComponent(String(val))
      );
    }

    if (p.in === "query") {
      if (
        schema.type === "string" ||
        !schema.type
      ) {
        fields.query.push(name);
      }

      if (
        val !== undefined ||
        p.required === true
      ) {
        query[name] = String(
          val ??
          example(p.schema, doc, "consulta_teste")
        );
      }
    }
  }

  const requestBody = resolve(doc, def.requestBody);
  const media = object(
    object(requestBody.content)["application/json"]
  );
  const schema = resolve(doc, media.schema);

  for (
    const [name, raw] of Object.entries(
      object(schema.properties)
    )
  ) {
    const fieldSchema = resolve(doc, raw);

    if (
      fieldSchema.type === "string" ||
      !fieldSchema.type
    ) {
      fields.body.push(name);
    }

    const val =
      baseline[name] ??
      example(raw, doc, "texto_teste");

    body[name] = [
      "string",
      "number",
      "boolean",
    ].includes(typeof val)
      ? (val as string | number | boolean)
      : "texto_teste";
  }

  if (
    !/^\/[A-Za-z0-9/_%.~-]*$/.test(urlPath) ||
    urlPath.startsWith("//") ||
    urlPath.includes("..")
  ) {
    reasonIfUnresolved =
      reasonIfUnresolved ||
      "Caminho não resolvido ou inválido no OpenAPI.";
  }

  const authorized =
    def["x-webdetector-safe-to-test"] === true;

  const authProfile =
    typeof def["x-webdetector-auth-profile"] === "string"
      ? String(def["x-webdetector-auth-profile"])
      : undefined;

  const scanSafe =
    def["x-webdetector-scan-safe"] !== false;

  const contract = object(def["x-webdetector-test"]);

  const eligibleForOldExecutor =
    authorized &&
    ["GET", "POST"].includes(method) &&
    (method === "GET"
      ? fields.query.length > 0
      : fields.body.length > 0) &&
    ["authentication", "generic"].includes(
      String(contract.kind)
    ) &&
    Object.keys(baseline).length > 0 &&
    !template.includes("{");

  const inheritedSecurity =
    def.security === undefined
      ? doc.security
      : def.security;

  return {
    op: def,
    method,
    template,
    urlPath: reasonIfUnresolved
      ? null
      : urlPath,
    query,
    body,
    inputs: fields,
    needsAuth:
      Array.isArray(inheritedSecurity) &&
      inheritedSecurity.length > 0,
    authorized,
    eligibleForOldExecutor,
    authProfile,
    scanSafe,
    reasonIfUnresolved,
  };
}

function outcomeFromHttp(
  status: number
): { state: ItemState; explanation: string } {
  if (status === 401 || status === 403) {
    return {
      state: "auth_required",
      explanation:
        "Rota exige autenticação ou permissão; não é prova de vulnerabilidade.",
    };
  }

  if (status === 429) {
    return {
      state: "blocked",
      explanation:
        "Limite de requisições atingido (HTTP 429).",
    };
  }

  if (status >= 500) {
    return {
      state: "error",
      explanation:
        `Servidor retornou HTTP ${status}; investigar sem assumir falha de segurança.`,
    };
  }

  if (status >= 400) {
    return {
      state: "checked",
      explanation:
        `HTTP ${status}. Entrada rejeitada ou recurso ausente; operação alcançada.`,
    };
  }

  return {
    state: "checked",
    explanation:
      `Requisição de referência respondeu HTTP ${status}.`,
  };
}

async function requestOne(
  base: URL,
  info: PlannedOperation,
  auth?: EvaluationAuth
): Promise<{ status: number; elapsed: number }> {
  const url = new URL(info.urlPath!, base);

  for (
    const [name, value] of Object.entries(info.query)
  ) {
    url.searchParams.set(name, value);
  }

  const headers: Record<string, string> = {
    Accept: "application/json, text/plain, text/html",
  };

  if (auth?.cookie) {
    headers.Cookie = auth.cookie;
  }

  if (auth?.bearer) {
    headers.Authorization = `Bearer ${auth.bearer}`;
  }

  const hasBody =
    ["POST", "PUT", "PATCH"].includes(info.method) &&
    Object.keys(info.body).length > 0;

  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }

  const start = performance.now();

  const response = await fetch(url, {
    method: info.method,
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(6000),
    body: hasBody
      ? JSON.stringify(info.body)
      : undefined,
  });

  await response.body?.cancel();

  return {
    status: response.status,
    elapsed: Math.round(
      performance.now() - start
    ),
  };
}

function authSpecs(
  doc: JsonObject
): Record<string, AuthProfileSpec> {
  const raw = object(
    doc["x-webdetector-auth-profiles"]
  );

  const result: Record<
    string,
    AuthProfileSpec
  > = {};

  for (
    const [id, rawProfile] of Object.entries(raw)
  ) {
    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(id)) {
      continue;
    }

    const o = object(rawProfile);

    const loginPath = String(
      o.loginPath ?? ""
    );

    const usernameField = String(
      o.usernameField ?? "username"
    );

    const passwordField = String(
      o.passwordField ?? "password"
    );

    const cookieName =
      typeof o.cookieName === "string"
        ? o.cookieName
        : undefined;

    const tokenField =
      typeof o.tokenField === "string"
        ? o.tokenField
        : undefined;

    if (
      !/^\/[a-zA-Z0-9/_-]+$/.test(loginPath) ||
      !/^[a-zA-Z_][\w-]{0,79}$/.test(usernameField) ||
      !/^[a-zA-Z_][\w-]{0,79}$/.test(passwordField) ||
      (!cookieName && !tokenField) ||
      (cookieName &&
        !/^[a-zA-Z0-9_-]{1,80}$/.test(cookieName)) ||
      (tokenField &&
        !/^[a-zA-Z0-9_.-]{1,80}$/.test(tokenField))
    ) {
      continue;
    }

    const loginOp = object(
      object(
        object(doc.paths)[loginPath]
      ).post
    );

    if (!Object.keys(loginOp).length) {
      continue;
    }

    result[id] = {
      description: String(
        o.description ?? id
      ).slice(0, 100),
      loginPath,
      usernameField,
      passwordField,
      cookieName,
      tokenField,
    };
  }

  return result;
}

async function signIn(
  base: URL,
  spec: AuthProfileSpec,
  creds: { username: string; password: string }
): Promise<{
  auth?: EvaluationAuth;
  httpStatus: number | null;
  reason: string;
}> {
  const url = new URL(
    spec.loginPath,
    base
  );

  try {
    const response = await fetch(url, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(6000),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        [spec.usernameField]: creds.username,
        [spec.passwordField]: creds.password,
      }),
    });

    if (!response.ok) {
      return {
        httpStatus: response.status,
        reason:
          `Login de teste recusado (HTTP ${response.status}).`,
      };
    }

    if (spec.cookieName) {
      const cookies =
        response.headers.getSetCookie?.() ||
        [response.headers.get("set-cookie") || ""];

      const match = cookies.find(
        (x) => x.startsWith(
          `${spec.cookieName}=`
        )
      );

      const cookie =
        match?.split(";", 1)[0];

      if (cookie) {
        return {
          auth: { cookie },
          httpStatus: response.status,
          reason: "Sessão de teste obtida.",
        };
      }
    }

    if (spec.tokenField) {
      const body: unknown =
        await response.json().catch(() => ({}));

      const token =
        object(body)[spec.tokenField];

      if (
        typeof token === "string" &&
        token.length > 10 &&
        token.length <= 4000
      ) {
        return {
          auth: { bearer: token },
          httpStatus: response.status,
          reason: "Token de teste obtido.",
        };
      }
    }

    return {
      httpStatus: response.status,
      reason:
        "Login HTTP 2xx, mas não retornou credencial conforme o contrato OpenAPI.",
    };
  } catch {
    return {
      httpStatus: null,
      reason:
        "Não foi possível conectar ao login de teste.",
    };
  }
}

export class ApplicationScanService {
  getJob(id: string): ScanJob | undefined {
    return JOBS.get(id);
  }


  async listSavedScans() {
    const { data, error } = await supabase
      .from("webdetector_scan_reports")
      .select(
        "id,scenario_id,status,started_at,finished_at,total,completed"
      )
      .order("started_at", {
        ascending: false,
      })
      .limit(100);

    if (error) {
      throw error;
    }

    return data || [];
  }

  async getSavedScan(id: string) {
    const { data, error } = await supabase
      .from("webdetector_scan_reports")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      throw new Error(
        "Relatório de varredura não encontrado."
      );
    }

    return data;
  }

  private async persistJob(
    job: ScanJob,
    status: "completed" | "failed"
  ) {
    try {
      const { error } = await supabase
        .from("webdetector_scan_reports")
        .upsert(
          {
            id: job.id,
            scenario_id: job.scenarioId,
            status,
            started_at: job.startedAt,
            finished_at: job.finishedAt,

            total: job.total,
            completed: job.completed,

            operations: job.operations,
            auth_results: job.authResults,

            error: job.error || null,
          },
          {
            onConflict: "id",
          }
        );

      if (error) {
        throw error;
      }

      job.saved = true;
    } catch (error) {
      job.saveError =
        error instanceof Error
          ? error.message
          : "Falha ao salvar a varredura.";
    }
  }

  async profiles(
    scenarioId: string
  ): Promise<AuthProfileInfo[]> {
    const { data, error } = await supabase
      .from("scenarios")
      .select("base_url")
      .eq("id", scenarioId)
      .single();

    if (error || !data) {
      throw new Error("Cenário não encontrado.");
    }

    const profiles = authSpecs(
      await specFor(
        localOrigin(data.base_url)
      )
    );

    return Object.entries(profiles).map(
      ([id, profile]) => ({
        id,
        description: profile.description,
      })
    );
  }

  async start(
    scenarioId: string,
    options: ScanOptions
  ): Promise<ScanJob> {
    const { data, error } = await supabase
      .from("scenarios")
      .select("id,base_url,attack_types")
      .eq("id", scenarioId)
      .single();

    if (error || !data) {
      throw new Error("Cenário não encontrado.");
    }

    const base = localOrigin(
      data.base_url
    );

    const spec = await specFor(base);

    const all: PlannedOperation[] = [];

    for (
      const [path, def] of Object.entries(
        object(spec.paths)
      )
    ) {
      if (!path.startsWith("/")) continue;

      const pathDef = object(def);

      for (const method of METHODS) {
        const op = object(
          pathDef[method.toLowerCase()]
        );

        if (!Object.keys(op).length) {
          continue;
        }

        all.push(
          plan(
            spec,
            path,
            method,
            op,
            pathDef
          )
        );
      }
    }

    if (!all.length) {
      throw new Error(
        "O OpenAPI não possui operações HTTP reconhecidas."
      );
    }

    const operations: ScannedOperation[] =
      all.map((item) => ({
        method: item.method,
        path: item.template,
        summary: String(
          item.op.summary ?? item.template
        ),
        inputs: item.inputs,
        needsAuth: item.needsAuth,
        authProfile: item.authProfile,
        state: "pending",
        httpStatus: null,
        durationMs: null,
        explanation: "Aguardando verificação",
        sqlInjection: { state: "pending" },
        xss: { state: "pending" },
      }));

    const job: ScanJob = {
      id: randomUUID(),
      scenarioId,
      status: "running",
      startedAt: new Date().toISOString(),
      total: all.length,
      completed: 0,
      operations,
      authResults: [],
    };

    if (JOBS.size >= MAX_JOBS) {
      const first = JOBS.keys().next().value;

      if (first) JOBS.delete(first);
    }

    JOBS.set(job.id, job);


    void this.runAll(
      job,
      all,
      base,
      spec,
      data.attack_types ?? [],
      options
    ).catch(async (error) => {
      job.error =
        error instanceof Error
          ? error.message
          : "Falha ao varrer a aplicação.";

      job.finishedAt = new Date().toISOString();

      await this.persistJob(job, "failed");

      job.status = "failed";
    });


    return job;
  }

  private async runAll(
    job: ScanJob,
    all: PlannedOperation[],
    base: URL,
    spec: JsonObject,
    attackTypes: string[],
    opts: ScanOptions
  ) {
    const evaluator =
      new SecurityEvaluationService();

    const profiles = authSpecs(spec);

    const sessions: Record<
      string,
      EvaluationAuth
    > = {};

    for (
      const [id, profile] of Object.entries(profiles)
    ) {
      const creds =
        opts.authProfiles?.[id];

      if (
        !creds?.username ||
        !creds?.password
      ) {
        job.authResults.push({
          profile: id,
          state: "missing_credentials",
          httpStatus: null,
          reason:
            "Informe uma conta de teste deste perfil.",
        });
        continue;
      }

      const result = await signIn(
        base,
        profile,
        creds
      );

      if (result.auth) {
        sessions[id] = result.auth;

        job.authResults.push({
          profile: id,
          state: "authenticated",
          httpStatus: result.httpStatus,
          reason: result.reason,
        });
      } else {
        job.authResults.push({
          profile: id,
          state: "login_failed",
          httpStatus: result.httpStatus,
          reason: result.reason,
        });
      }
    }

    for (let i = 0; i < all.length; i++) {
      const op = all[i];
      const item = job.operations[i];

      item.sqlInjection = {
        state: "not_applicable",
        reason:
          "Nenhum campo de entrada textual aplicável.",
      };

      item.xss = {
        state: "not_applicable",
        reason:
          "Nenhum campo de entrada textual aplicável.",
      };

      try {
        const selectedAuth =
          op.authProfile
            ? sessions[op.authProfile]
            : undefined;

        if (!op.urlPath) {
          item.state = "skipped";
          item.explanation =
            op.reasonIfUnresolved ||
            "Rota não resolvida";
        } else if (
          op.needsAuth &&
          !op.authProfile
        ) {
          item.state = "auth_required";
          item.explanation =
            "Operação exige autenticação, mas o OpenAPI não declara x-webdetector-auth-profile.";
        } else if (
          op.needsAuth &&
          !selectedAuth
        ) {
          item.state = "auth_required";
          item.explanation =
            `Credencial de teste ausente ou inválida para o perfil ${op.authProfile}. Nenhuma requisição protegida foi enviada.`;
        } else if (!op.scanSafe) {
          item.state = "skipped";
          item.explanation =
            "Operação excluída de requisições automáticas pelo OpenAPI (x-webdetector-scan-safe: false).";
        } else if (
          op.method !== "GET" &&
          !opts.includeMutations &&
          op.op["x-webdetector-scan-readonly"] !== true
        ) {
          item.state = "skipped";
          item.explanation =
            "Método com potencial alteração de estado. Ative o teste de operações de escrita.";
        } else if (
          op.method !== "GET" &&
          !op.authorized
        ) {
          item.state = "skipped";
          item.explanation =
            "Operação de escrita não autorizada pelo contrato OpenAPI.";
        } else {
          try {
            const answer = await requestOne(
              base,
              op,
              selectedAuth
            );

            item.httpStatus = answer.status;
            item.durationMs = answer.elapsed;

            const evaluated = outcomeFromHttp(
              answer.status
            );

            item.state = evaluated.state;
            item.explanation =
              evaluated.explanation;

            if (
              answer.status === 401 &&
              object(
                object(op.op["x-webdetector-test"])
                  .auth
              ).confirmation_mode
            ) {
              item.state = "checked";
              item.explanation =
                "Login de referência negado (401), conforme esperado para credenciais inválidas.";
            }
          } catch (error) {
            item.state = "error";
            item.explanation =
              error instanceof Error
                ? error.message
                : "Falha de comunicação HTTP";
          }
        }

        const inputs = [
          ...op.inputs.path,
          ...op.inputs.query,
          ...op.inputs.body,
        ];

        if (
          [
            "skipped",
            "auth_required",
            "blocked",
            "error",
          ].includes(item.state)
        ) {
          item.sqlInjection = {
            state: "skipped",
            reason: item.explanation,
          };

          item.xss = {
            state: "skipped",
            reason: item.explanation,
          };

          continue;
        }

        if (inputs.length > 0) {
          item.sqlInjection = {
            state: "not_supported_yet",
            reason:
              "Teste ativo exige contrato de operação compatível.",
          };

          item.xss = {
            state: "not_supported_yet",
            reason:
              "Teste ativo exige contrato de operação compatível.",
          };
        }

        if (!opts.includeSecurityTests) {
          if (inputs.length) {
            item.sqlInjection = {
              state: "skipped",
              reason:
                "Testes de injeção desativados nesta varredura.",
            };

            item.xss = {
              state: "skipped",
              reason:
                "Testes de injeção desativados nesta varredura.",
            };
          }

          continue;
        }

        if (item.state !== "checked") {
          continue;
        }

        const isExpectedDeniedLogin =
          item.httpStatus === 401 &&
          object(
            object(op.op["x-webdetector-test"])
              .auth
          ).confirmation_mode !== undefined;

        if (
          !isExpectedDeniedLogin &&
          (
            item.httpStatus === null ||
            item.httpStatus < 200 ||
            item.httpStatus >= 300
          )
        ) {
          item.sqlInjection = {
            state: "skipped",
            reason:
              `Referência HTTP ${item.httpStatus ?? "sem resposta"}. Não executar injeção sem baseline 2xx.`,
          };

          item.xss = {
            state: "skipped",
            reason:
              `Referência HTTP ${item.httpStatus ?? "sem resposta"}. Não executar injeção sem baseline 2xx.`,
          };

          continue;
        }

        if (!op.eligibleForOldExecutor) {
          continue;
        }

        const field =
          (
            op.method === "GET"
              ? op.inputs.query
              : op.inputs.body
          )[0];

        if (!field) continue;

        for (
          const [
            attackType,
            key,
            enabledName,
          ] of [
            ["SQLI", "sqlInjection", "SQL Injection"],
            ["XSS", "xss", "XSS"],
          ] as const
        ) {
          if (!attackTypes.includes(enabledName)) {
            item[key] = {
              state: "skipped",
              reason:
                `${enabledName} não habilitado no cenário.`,
            };
            continue;
          }

          item[key] = { state: "pending" };

          try {
            const route =
              await evaluator.selectRoute(
                job.scenarioId,
                op.urlPath!,
                op.method as "GET" | "POST"
              );

            const report =
              await evaluator.run(
                {
                  scenarioId: job.scenarioId,
                  routeId: route.id,
                  field,
                  attackType: attackType as AttackType,
                },
                selectedAuth
              );

            item[key] = {
              state: "completed",
              outcome: report.outcome,
              reportId: report.id,
              field,
            };
          } catch (error) {
            item[key] = {
              state: "error",
              field,
              reason:
                error instanceof Error
                  ? error.message
                  : "Falha ao executar teste de segurança",
            };
          }
        }
      } catch (error) {
        item.state = "error";
        item.explanation =
          error instanceof Error
            ? error.message
            : "Falha ao analisar operação";

        item.sqlInjection = {
          state: "error",
          reason: item.explanation,
        };

        item.xss = {
          state: "error",
          reason: item.explanation,
        };
      } finally {
        job.completed++;
        await wait(150);
      }
    }

    job.finishedAt = new Date().toISOString();
    await this.persistJob(job, "completed");
    job.status = "completed";

  }
}

export const applicationScanService =
  new ApplicationScanService();