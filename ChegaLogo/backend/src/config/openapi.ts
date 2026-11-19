type Obj = Record<string, unknown>;
type Operation = Record<string, unknown>;

const text = { type: "string" };
const success = { type: "boolean" };

const sessionSecurity = [
  { chegalogoSession: [] },
];

function errorResponse(description: string) {
  return {
    description,
    content: {
      "application/json": {
        schema: {
          $ref: "#/components/schemas/ErrorResponse",
        },
      },
    },
  };
}

function jsonBody(schema: Obj) {
  return {
    required: true,
    content: {
      "application/json": { schema },
    },
  };
}

function jsonResponse(
  description: string,
  schema: Obj
) {
  return {
    description,
    content: {
      "application/json": { schema },
    },
  };
}

const loginSchema = {
  type: "object",
  required: ["username", "password"],
  additionalProperties: false,
  properties: {
    username: {
      type: "string",
      minLength: 1,
      maxLength: 100,
    },
    password: {
      type: "string",
      minLength: 1,
      maxLength: 200,
      format: "password",
    },
  },
};

const loginResponse = jsonResponse(
  "Login realizado com cookie de sessão.",
  {
    type: "object",
    properties: {
      success,
      message: text,
      user: {
        type: "object",
        additionalProperties: true,
      },
    },
  }
);

const dataResponse = jsonResponse(
  "Consulta realizada.",
  {
    type: "object",
    properties: {
      success,
      data: {
        type: "object",
        additionalProperties: true,
      },
    },
  }
);

const paths: Record<
  string,
  Record<string, Operation>
> = {
  "/api/health": {
    get: {
      tags: ["Sistema"],
      summary: "Consultar saúde da API",
      responses: {
        "200": jsonResponse("API funcionando.", {
          type: "object",
          properties: {
            status: text,
            application: text,
            message: text,
            version: text,
          },
        }),
      },
    },
  },

  "/api/auth/login": {
    post: {
      tags: ["Autenticação"],
      summary: "Login administrativo",
      requestBody: jsonBody(loginSchema),
      responses: {
        "200": loginResponse,
        "400": errorResponse("Dados inválidos."),
        "401": errorResponse("Credenciais inválidas."),
        "429": errorResponse("Muitas tentativas."),
      },
    },
  },

  "/api/auth/me": {
    get: {
      tags: ["Autenticação"],
      summary: "Consultar sessão administrativa",
      security: sessionSecurity,
      responses: {
        "200": dataResponse,
        "401": errorResponse("Não autenticado."),
      },
    },
  },

  "/api/auth/logout": {
    post: {
      tags: ["Autenticação"],
      summary: "Encerrar sessão",
      security: sessionSecurity,
      responses: {
        "200": jsonResponse("Sessão encerrada.", {
          type: "object",
          properties: {
            success,
            message: text,
          },
        }),
        "401": errorResponse("Não autenticado."),
      },
    },
  },

  "/api/clients/register": {
    post: {
      tags: ["Clientes"],
      summary: "Cadastrar cliente",
      requestBody: jsonBody({
        type: "object",
        required: [
          "fullName",
          "username",
          "email",
          "password",
        ],
        additionalProperties: false,
        properties: {
          fullName: {
            type: "string",
            minLength: 3,
            maxLength: 120,
          },
          username: {
            type: "string",
            pattern: "^[a-z0-9_]{3,30}$",
          },
          email: {
            type: "string",
            format: "email",
          },
          phone: {
            type: "string",
          },
          password: {
            type: "string",
            format: "password",
            minLength: 8,
          },
        },
      }),
      responses: {
        "201": dataResponse,
        "400": errorResponse("Cadastro inválido."),
        "409": errorResponse("Cliente já cadastrado."),
        "429": errorResponse("Muitas tentativas."),
      },
    },
  },

  "/api/clients/login": {
    post: {
      tags: ["Clientes"],
      summary: "Login de cliente",
      requestBody: jsonBody(loginSchema),
      responses: {
        "200": loginResponse,
        "400": errorResponse("Dados inválidos."),
        "401": errorResponse("Credenciais inválidas."),
        "429": errorResponse("Muitas tentativas."),
      },
    },
  },

  "/api/deliveries": {
    get: {
      tags: ["Entregas"],
      summary: "Listar e pesquisar entregas",
      security: sessionSecurity,
      parameters: [
        {
          name: "search",
          in: "query",
          required: false,
          description: "Texto para pesquisar entregas.",
          schema: {
            type: "string",
            maxLength: 200,
          },
          example: "CHG20260001",
        },
      ],
      responses: {
        "200": jsonResponse("Lista de entregas.", {
          type: "object",
          properties: {
            success,
            total: { type: "integer" },
            data: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: true,
              },
            },
          },
        }),
        "400": errorResponse("Pesquisa inválida."),
        "401": errorResponse("Não autenticado."),
        "403": errorResponse("Sem permissão."),
      },
    },
  },

  "/api/deliveries/summary": {
    get: {
      tags: ["Entregas"],
      summary: "Resumo das entregas",
      security: sessionSecurity,
      responses: {
        "200": dataResponse,
        "401": errorResponse("Não autenticado."),
        "403": errorResponse("Sem permissão."),
      },
    },
  },

  "/api/deliveries/{id}": {
    get: {
      tags: ["Entregas"],
      summary: "Consultar entrega por ID",
      security: sessionSecurity,
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: {
            type: "integer",
            minimum: 1,
          },
          example: 1,
        },
      ],
      responses: {
        "200": dataResponse,
        "400": errorResponse("ID inválido."),
        "401": errorResponse("Não autenticado."),
        "403": errorResponse("Sem permissão."),
        "404": errorResponse("Entrega não encontrada."),
      },
    },
  },

  "/api/tracking/{code}": {
    get: {
      tags: ["Rastreamento"],
      summary: "Rastrear encomenda",
      parameters: [
        {
          name: "code",
          in: "path",
          required: true,
          schema: {
            type: "string",
            pattern: "^CHG[0-9]{8}$",
          },
          example: "CHG20260001",
        },
      ],
      responses: {
        "200": dataResponse,
        "400": errorResponse("Código inválido."),
        "404": errorResponse("Não encontrada."),
        "429": errorResponse("Muitas consultas."),
      },
    },
  },

  "/api/support": {
    post: {
      tags: ["Suporte"],
      summary: "Criar solicitação de suporte",
      security: sessionSecurity,
      requestBody: jsonBody({
        type: "object",
        required: ["subject", "message"],
        additionalProperties: false,
        properties: {
          subject: {
            type: "string",
            minLength: 3,
            maxLength: 120,
          },
          message: {
            type: "string",
            minLength: 5,
            maxLength: 2000,
          },
        },
      }),
      responses: {
        "201": dataResponse,
        "400": errorResponse("Campos inválidos."),
        "401": errorResponse("Não autenticado."),
        "403": errorResponse("Sem permissão."),
        "429": errorResponse("Muitas solicitações."),
      },
    },
  },

  "/api/support/mine": {
    get: {
      tags: ["Suporte"],
      summary: "Listar minhas solicitações",
      security: sessionSecurity,
      responses: {
        "200": dataResponse,
        "401": errorResponse("Não autenticado."),
        "403": errorResponse("Sem permissão."),
      },
    },
  },

  "/api/support/admin": {
    get: {
      tags: ["Suporte"],
      summary: "Listar todas as solicitações",
      security: sessionSecurity,
      responses: {
        "200": dataResponse,
        "401": errorResponse("Não autenticado."),
        "403": errorResponse("Sem permissão."),
      },
    },
  },
};

// A rota vulnerável existe apenas no laboratório.
if (process.env.NODE_ENV !== "production") {
  paths["/api/lab/login"] = {
    post: {
      tags: ["Laboratório de Segurança"],
      summary: "Login fictício vulnerável a SQL Injection",
      description:
        "Rota propositalmente vulnerável, com banco SQLite em memória e dados fictícios.",

      "x-webdetector-safe-to-test": true,

      "x-webdetector-test": {
        kind: "authentication",
        baseline: {
          username: "webdetector_inexistente",
          password: "SenhaInvalida_LAB_2026",
        },
        auth: {
          confirmation_mode: "response",
          success_fields: [
            "success",
            "lab_authenticated",
          ],
          identity_fields: ["users"],
          session_cookie_names: [],
        },
      },

      requestBody: jsonBody(loginSchema),

      responses: {
        "200": jsonResponse(
          "Autenticação fictícia realizada.",
          {
            type: "object",
            properties: {
              success,
              lab_authenticated: {
                type: "boolean",
              },
              message: text,
              total: { type: "integer" },
              users: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "integer" },
                    username: text,
                  },
                },
              },
            },
          }
        ),
        "400": errorResponse("Erro de consulta."),
        "401": errorResponse("Credenciais inválidas."),
      },
    },
  };
}

// Modo de demonstração somente local.
const demoMode =
  process.env.NODE_ENV === "development" &&
  process.env.WD_DEMO_MODE === "1";

// Baselines fictícias por operação.
const baselines: Record<
  string,
  Record<string, string>
> = {
  "/api/health": {
    _demo: "health",
  },

  "/api/auth/login": {
    username: "wd_usuario_inexistente",
    password: "SenhaInvalida_WD_2026",
  },

  "/api/auth/me": {
    _demo: "session",
  },

  "/api/auth/logout": {
    _demo: "logout",
  },

  "/api/clients/register": {
    fullName: "Cliente Ficticio",
    username: "usuario invalido",
    email: "email-invalido",
    phone: "",
    password: "curta",
  },

  "/api/clients/login": {
    username: "wd_cliente_inexistente",
    password: "SenhaInvalida_WD_2026",
  },

  "/api/deliveries": {
    search: "consulta_sem_resultado_wd",
  },

  "/api/deliveries/summary": {
    _demo: "summary",
  },

  "/api/deliveries/{id}": {
    _demo: "delivery",
  },

  "/api/tracking/{code}": {
    _demo: "tracking",
  },

  "/api/support": {
    subject: "x",
    message: "x",
  },

  "/api/support/mine": {
    _demo: "support",
  },

  "/api/support/admin": {
    _demo: "support",
  },
};

if (demoMode) {
  for (
    const [path, methods] of Object.entries(paths)
  ) {
    for (
      const verb of ["get", "post"] as const
    ) {
      const operation = methods[verb];

      if (!operation) continue;

      operation["x-webdetector-safe-to-test"] =
        true;

      // Preserva o contrato já validado
      // do laboratório SQLi.
      if (path === "/api/lab/login") {
        continue;
      }

      const baseline = baselines[path];

      if (!baseline) continue;

      const isLogin = [
        "/api/auth/login",
        "/api/clients/login",
      ].includes(path);

      if (isLogin) {
        operation["x-webdetector-test"] = {
          kind: "authentication",
          baseline,
          auth: {
            confirmation_mode: "session",
            success_fields: ["success"],
            identity_fields: ["user"],
            session_cookie_names: [
              "chegalogo_session",
            ],
          },
        };
      } else {
        operation["x-webdetector-test"] = {
          kind: "generic",
          baseline,
        };
      }
    }
  }

  // Define qual perfil autenticado acessa cada rota.
  const authMap: Record<string, string> = {
    "/api/auth/me": "funcionario",
    "/api/auth/logout": "funcionario",

    "/api/deliveries": "funcionario",
    "/api/deliveries/summary": "funcionario",
    "/api/deliveries/{id}": "funcionario",

    "/api/support/admin": "funcionario",

    "/api/support": "cliente",
    "/api/support/mine": "cliente",
  };

  for (
    const [path, profile] of Object.entries(
      authMap
    )
  ) {
    const operations = paths[path];

    if (!operations) continue;

    for (
      const operation of Object.values(operations)
    ) {
      operation["x-webdetector-auth-profile"] =
        profile;
    }
  }

  // Login não cria registros persistentes.
  for (const path of [
    "/api/auth/login",
    "/api/clients/login",
    "/api/lab/login",
  ]) {
    const operation = paths[path]?.post;

    if (operation) {
      operation["x-webdetector-scan-readonly"] =
        true;
    }
  }

  // Evita cadastros, logout e abertura de tickets
  // durante a varredura automática.
  for (const path of [
    "/api/auth/logout",
    "/api/clients/register",
    "/api/support",
  ]) {
    const operations = paths[path];

    if (!operations) continue;

    for (
      const operation of Object.values(operations)
    ) {
      operation["x-webdetector-scan-safe"] =
        false;
    }
  }
}

export const openapiSpec = {
  openapi: "3.0.3",

  info: {
    title: "ChegaLogo API",
    version: "1.0.0",
    description: demoMode
      ? "Ambiente local de demonstração do WebDetector."
      : "API da transportadora ChegaLogo.",
  },

  servers: [
    {
      url: "http://127.0.0.1:8000",
      description: "Ambiente local",
    },
  ],

  tags: [
    { name: "Sistema" },
    { name: "Autenticação" },
    { name: "Clientes" },
    { name: "Entregas" },
    { name: "Rastreamento" },
    { name: "Suporte" },
    { name: "Laboratório de Segurança" },
  ],

  components: {
    securitySchemes: {
      chegalogoSession: {
        type: "apiKey",
        in: "cookie",
        name: "chegalogo_session",
        description: "Cookie de sessão HTTP-only.",
      },
    },

    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            example: false,
          },
          message: text,
        },
      },
    },
  },

  ...(demoMode
    ? {
        "x-webdetector-auth-profiles": {
          funcionario: {
            description:
              "Funcionário administrativo (conta fictícia)",
            loginPath: "/api/auth/login",
            usernameField: "username",
            passwordField: "password",
            cookieName: "chegalogo_session",
          },

          cliente: {
            description:
              "Cliente de testes (conta fictícia)",
            loginPath: "/api/clients/login",
            usernameField: "username",
            passwordField: "password",
            cookieName: "chegalogo_session",
          },
        },
      }
    : {}),

  paths,
};