import { supabase } from "../config/supabase";

const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1"]);

interface HttpEvidence {
  status: number;
  success: boolean;
  userReturned: boolean;
  sessionCookieReturned: boolean;
  labAuthenticated: boolean;
  usersCount: number;
  durationMs: number;
}

interface TestInput {
  scenarioId: string;
  routeId: string;
  field: "username" | "password";
}

function assertLocalTarget(baseUrl: string, routePath: string) {
  const base = new URL(baseUrl);
  if (
    base.protocol !== "http:" ||
    !ALLOWED_HOSTS.has(base.hostname) ||
    !base.port ||
    base.pathname !== "/" || base.search || base.hash ||
    base.username || base.password
  ) {
    throw new Error("Somente aplicações HTTP locais são permitidas.");
  }
  if (
    !/^\/[a-zA-Z0-9/_-]+$/.test(routePath) ||
    !/(?:^|\/)(login|signin|sign-in)$/.test(routePath.toLowerCase())
  ) {
    throw new Error("Selecione uma rota concreta de login (POST) cadastrada no cenário.");
  }
  return new URL(routePath, base);
}

async function sendLogin(url: URL, username: string, password: string): Promise<HttpEvidence> {
  const started = performance.now();
  const response = await fetch(url, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(5000),
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const raw = (await response.text()).slice(0, 10000);
  let json: unknown = null;
  try { json = JSON.parse(raw); } catch { }
  const data = json && typeof json === "object" ? json as Record<string, unknown> : {};
  const user = data.user;

const users = Array.isArray(data.users)
  ? data.users
  : [];

const userReturned =
  (typeof user === "object" && user !== null) ||
  users.length > 0;

const labAuthenticated =
  data.lab_authenticated === true;

const usersCount = users.length;

  const sessionCookieReturned = response.headers.get("set-cookie")?.includes("chegalogo_session=") ?? false;
  return {
  status: response.status,
  success: data.success === true,
  userReturned,
  sessionCookieReturned,
  labAuthenticated,
  usersCount,
  durationMs: Math.round(performance.now() - started),
};
}

export class SqlInjectionTestService {
  async execute({ scenarioId, routeId, field }: TestInput) {
    const { data: scenario, error: scenarioError } = await supabase
      .from("scenarios").select("id,name,base_url,attack_types").eq("id", scenarioId).single();
    if (scenarioError || !scenario) throw new Error("Cenário não encontrado.");
    if (!scenario.attack_types?.includes("SQL Injection")) {
      throw new Error("Habilite SQL Injection neste cenário.");
    }
    const { data: route, error: routeError } = await supabase
      .from("scenario_routes").select("id,path,method,enabled")
      .eq("id", routeId).eq("scenario_id", scenarioId).single();
    if (routeError || !route || !route.enabled || route.method !== "POST") {
      throw new Error("Rota POST selecionada não existe ou está desativada.");
    }
    const target = assertLocalTarget(scenario.base_url, route.path);

    const baseline = { username: "webdetector_inexistente", password: "SenhaInvalida_LAB_2026" };
    const falsePayload = "' OR '1'='2' -- ";
    const truePayload = "' OR '1'='1' -- ";
    const build = (value: string) => ({ ...baseline, [field]: value });
    const reference = await sendLogin(target, baseline.username, baseline.password);

    if (reference.success || reference.userReturned || reference.sessionCookieReturned) {
      return {
        route: { method: "POST", path: route.path }, field,
        outcome: "inconclusive" as const,
        explanation: "A referência inválida recebeu indícios de autenticação; teste interrompido.",
        reference, falseCondition: null, trueCondition: null,
        testPayload: null,
        ml: null,
      };
    }
    if (reference.status === 429) throw new Error("Rate limit ativo (HTTP 429); aguarde para testar.");

    const falseBody = build(falsePayload);
    const trueBody = build(truePayload);
    const falseCondition = await sendLogin(target, falseBody.username, falseBody.password);
    if (falseCondition.status === 429) throw new Error("Rate limit ativo (HTTP 429) no controle falso.");
    const trueCondition = await sendLogin(target, trueBody.username, trueBody.password);

    
const authenticated = (r: HttpEvidence) => {
  const successfulResponse =
    r.status >= 200 &&
    r.status < 300 &&
    r.success &&
    r.userReturned;

  if (!successfulResponse) {
    return false;
  }

  if (route.path === "/api/lab/login") {
    return r.labAuthenticated;
  }

  return r.sessionCookieReturned;
};

    const controlsRejected =
      reference.status === 401 && falseCondition.status === 401 &&
      !authenticated(reference) && !authenticated(falseCondition);
    const confirmed = controlsRejected && authenticated(trueCondition);
    const inconclusive = [reference, falseCondition, trueCondition]
      .some(r => r.status === 429 || r.status >= 500) ||
      (!controlsRejected && !confirmed);
    const outcome = confirmed ? "confirmed" : inconclusive ? "inconclusive" : "not_confirmed";


    let ml: { classification: string; algorithm: string | null; reasons: string[] } | null = null;
    try {
      const response = await fetch("http://127.0.0.1:5000/api/ml/predict", {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(5000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "POST", path: route.path,
          payload: new URLSearchParams(trueBody).toString(),
          attempts_1m: 3,
          failed_logins_1m: Number(reference.status === 401) + Number(falseCondition.status === 401),
        }),
      });
      if (response.ok) {
        const prediction = await response.json() as Record<string, unknown>;
        ml = {
          classification: String(prediction.classification ?? "UNKNOWN"),
          algorithm: typeof prediction.algorithm === "string" ? prediction.algorithm : null,
          reasons: Array.isArray(prediction.reasons) ? prediction.reasons.filter((x): x is string => typeof x === "string") : [],
        };
      }
    } catch { }

    return {
      route: { method: "POST", path: route.path },
      field,
      outcome,
      explanation: confirmed
  ? route.path === "/api/lab/login"
    ? `SQL Injection confirmada no laboratório: a condição verdadeira permitiu autenticação fictícia indevida e retornou ${trueCondition.usersCount} registro(s), enquanto as duas requisições de controle foram recusadas.`
    : "SQL Injection confirmada: os controles foram recusados, mas a condição verdadeira retornou usuário e cookie de sessão."
        : inconclusive
          ? "As respostas não permitem concluir se ocorreu autenticação indevida."
          : "Nenhum desvio de autenticação foi demonstrado por este teste.",
      reference,
      falseCondition,
      trueCondition,
      testPayload: { field, value: truePayload },
      ml,
    };
  }
}
