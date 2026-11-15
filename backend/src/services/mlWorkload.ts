export type Label = "NORMAL" | "SQLI" | "XSS" | "BRUTE_FORCE";
export type HttpMethod = "GET" | "POST";
export type StoredRoute = { path: string; method: string; enabled: boolean };
type JsonMap = Record<string, unknown>;

export type WorkItem = {
  expected: Label; 
  method: HttpMethod;
  path: string;     
  payload: string;  
  body?: JsonMap;
  query?: Record<string, string>;
  isAuth: boolean;
  accountKey: string | null;
};

type Operation = {
  method: HttpMethod;
  template: string;
  path: string;
  body?: JsonMap;
  query: Record<string, string>;
  textField?: string;
  textLocation?: "body" | "query";
  isAuth: boolean;
  accountField?: string;
  secretField?: string;
};

function obj(value: unknown): JsonMap {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonMap : {};
}

function resolveRef(raw: unknown, root: JsonMap): JsonMap {
  let value = obj(raw);
  const visited = new Set<string>();
  for (let i = 0; i < 8; i++) {
    const ref = value.$ref;
    if (typeof ref !== "string" || !ref.startsWith("#/")) return value;
    if (visited.has(ref)) throw new Error(`Referência circular OpenAPI: ${ref}`);
    visited.add(ref);
    let next: unknown = root;
    for (const part of ref.slice(2).split("/")) {
      next = obj(next)[part.replace(/~1/g, "/").replace(/~0/g, "~")];
    }
    value = obj(next);
    if (!Object.keys(value).length) throw new Error(`Referência não encontrada: ${ref}`);
  }
  throw new Error("Referência OpenAPI muito profunda.");
}

function exampleFor(raw: unknown, root: JsonMap): unknown {
  const schema = resolveRef(raw, root);
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  const examples = Array.isArray(schema.enum) ? schema.enum : [];
  if (examples.length) return examples[0];
  switch (schema.type) {
    case "string": return schema.format === "email" ? "lab@example.test" : "texto_teste";
    case "integer": case "number": return 1;
    case "boolean": return false;
    case "array": return [exampleFor(schema.items, root)];
    case "object": {
      const result: JsonMap = {};
      for (const [key, property] of Object.entries(obj(schema.properties))) {
        result[key] = exampleFor(property, root);
      }
      return result;
    }
    default: return "texto_teste";
  }
}

function operationFor(route: StoredRoute, doc: JsonMap): Operation {
  const method = route.method.toUpperCase();
  if (method !== "GET" && method !== "POST") {
    throw new Error(`Método não suportado no laboratório: ${route.method}`);
  }
  const paths = obj(doc.paths);
  const pathItem = obj(paths[route.path]);
  const op = obj(pathItem[method.toLowerCase()]);
  if (!Object.keys(op).length) {
    throw new Error(`Rota não encontrada no OpenAPI: ${method} ${route.path}`);
  }
  
  if (method === "POST" && op["x-webdetector-safe-to-test"] !== true) {
    throw new Error(
      `POST ${route.path} precisa de x-webdetector-safe-to-test: true no OpenAPI ` +
      "(apenas endpoints autorizados, com dados fictícios)."
    );
  }
  const pathParams = [
    ...(Array.isArray(pathItem.parameters) ? pathItem.parameters : []),
    ...(Array.isArray(op.parameters) ? op.parameters : []),
  ];
  let concretePath = route.path;
  const query: Record<string, string> = {};
  for (const raw of pathParams) {
    const p = resolveRef(raw, doc);
    const name = p.name;
    const location = p.in;
    if (typeof name !== "string") continue;
    const value = p.example ?? exampleFor(p.schema, doc);
    if (location === "path") {
      if (p.example === undefined && obj(p.schema).example === undefined && obj(p.schema).default === undefined) {
        throw new Error(`Informe um example para o parâmetro obrigatório ${name} em ${route.path}`);
      }
      concretePath = concretePath.replace(`{${name}}`, encodeURIComponent(String(value)));
    }
    if (location === "query" && p.required === true) query[name] = String(value);
  }
  if (concretePath.includes("{") || !/^\/[^?#\\]*$/.test(concretePath) || concretePath.startsWith("//")) {
    throw new Error(`Caminho inválido ou com parâmetros não resolvidos: ${route.path}`);
  }
  let body: JsonMap | undefined;
  let textField: string | undefined;
  let textLocation: "body" | "query" | undefined;
  if (method === "POST") {
    const requestBody = resolveRef(op.requestBody, doc);
    const jsonContent = obj(obj(requestBody.content)["application/json"]);
    const schema = resolveRef(jsonContent.schema, doc);
    if (schema.type !== "object") {
      throw new Error(`POST ${route.path} precisa documentar requestBody application/json com propriedades.`);
    }
    body = obj(exampleFor(schema, doc));
    const properties = obj(schema.properties);
    const candidate = Object.entries(properties).find(([, s]) => resolveRef(s, doc).type === "string");
    textField = candidate?.[0];
    if (textField) textLocation = "body";
  }
  if (method === "GET") {
    const textQuery = pathParams.map(raw => resolveRef(raw, doc)).find(p =>
      p.in === "query" && typeof p.name === "string" &&
      resolveRef(p.schema, doc).type === "string"
    );
    if (typeof textQuery?.name === "string") {
      textField = textQuery.name;
      textLocation = "query";
      query[textField] = String(textQuery.example ?? "consulta_teste");
    }
  }
  const auth = op["x-webdetector-auth"] === true;
  const fields = Object.keys(body ?? {});
  const accountField = fields.find(k => /^(username|email|user|login|usuario)$/i.test(k));
  const secretField = fields.find(k => /^(password|senha|pass)$/i.test(k));
  if (auth && (!accountField || !secretField)) {
    throw new Error(`POST ${route.path}: autenticação exige campos de usuário e senha no OpenAPI.`);
  }

  if (auth && accountField) { textField = accountField; textLocation = "body"; }
  return { method, template: route.path, path: concretePath, body, query,
    textField, textLocation, isAuth: auth, accountField, secretField };
}

const sqlSamples = ["' OR '1'='1", "admin'--", "' UNION SELECT NULL--", "' AND 'a'='a"];
const xssSamples = ["<script>alert(1)</script>", "<img src=x onerror=alert(1)>", "<svg onload=alert(1)>"];

export function createWorkload(
  routes: StoredRoute[], openapi: JsonMap, attackTypes: string[], requested: number
): WorkItem[] {
  const operations = routes.filter(r => r.enabled).map(r => operationFor(r, openapi));
  if (!operations.length) throw new Error("Nenhuma rota ativa no cenário.");
  type Generator = (i: number) => WorkItem;
  const generators = new Map<Label, Generator[]>();
  const add = (label: Label, generator: Generator) => {
    generators.set(label, [...(generators.get(label) ?? []), generator]);
  };
  const make = (op: Operation, label: Label, body: JsonMap | undefined, query: Record<string, string>, accountKey: string | null): WorkItem => ({
    expected: label, method: op.method, path: op.path, body, query,
    payload: body ? JSON.stringify(body) : new URLSearchParams(query).toString() || op.path,
    isAuth: op.isAuth, accountKey,
  });
  for (const op of operations) {
    add("NORMAL", i => {
      const body = op.body ? { ...op.body } : undefined;
      if (op.isAuth && body && op.accountField && op.secretField) {
        body[op.accountField] = "usuario_lab";
        body[op.secretField] = `SenhaLab${i}!`;
      }
      return make(op, "NORMAL", body, { ...op.query }, op.isAuth ? "usuario_lab" : null);
    });
    if (op.textField) {
      if (attackTypes.includes("SQL Injection")) add("SQLI", i => {
        const injected = sqlSamples[i % sqlSamples.length];
        const body = op.body ? { ...op.body } : undefined;
        const query = { ...op.query };
        if (op.textLocation === "body" && body) body[op.textField!] = injected;
        if (op.textLocation === "query") query[op.textField!] = injected;
        return make(op, "SQLI", body, query, op.isAuth ? "usuario_lab" : null);
      });
      if (attackTypes.includes("XSS")) add("XSS", i => {
        const injected = xssSamples[i % xssSamples.length];
        const body = op.body ? { ...op.body } : undefined;
        const query = { ...op.query };
        if (op.textLocation === "body" && body) body[op.textField!] = injected;
        if (op.textLocation === "query") query[op.textField!] = injected;
        return make(op, "XSS", body, query, op.isAuth ? "usuario_lab" : null);
      });
    }
    if (op.isAuth && op.accountField && op.secretField && attackTypes.includes("Brute Force")) {
      add("BRUTE_FORCE", i => {
        const body = { ...op.body!, [op.accountField!]: "usuario_lab", [op.secretField!]: `TentativaLab${i + 1}` };
        return make(op, "BRUTE_FORCE", body, { ...op.query }, "usuario_lab");
      });
    }
  }
  const requestedLabels: Label[] = ["NORMAL"];
  if (attackTypes.includes("SQL Injection")) requestedLabels.push("SQLI");
  if (attackTypes.includes("XSS")) requestedLabels.push("XSS");
  if (attackTypes.includes("Brute Force")) requestedLabels.push("BRUTE_FORCE");
  const unsupported = requestedLabels.filter(label => !(generators.get(label)?.length));
  if (unsupported.length) throw new Error(`Nenhum endpoint compatível com: ${unsupported.join(", ")}. Verifique requestBody, campos e x-webdetector-auth.`);
  const max = Math.min(100, Math.max(1, Math.floor(Number(requested) || 20)));
  const result: WorkItem[] = [];
  const sequenceByLabel = new Map<Label, number>();
  for (let i = 0; i < max; i++) {
    const label = requestedLabels[i % requestedLabels.length];
    const index = sequenceByLabel.get(label) ?? 0;
    const options = generators.get(label)!;
    result.push(options[index % options.length](Math.floor(index / options.length)));
    sequenceByLabel.set(label, index + 1);
  }
  return result;
}
