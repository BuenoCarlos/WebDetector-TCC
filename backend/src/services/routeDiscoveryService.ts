import { z } from "zod";

const DOCUMENT_PATHS = [
  "/openapi.json",
  "/swagger.json",
  "/api-docs.json",
  "/api/openapi.json",
];

const METHODS = [
  "get", "post", "put", "patch", "delete",
] as const;

const schema = z.object({
  openapi: z.string(),
  paths: z.record(z.string(), z.unknown()),
});

export class RouteDiscoveryService {
  async discover(baseUrl: string) {
    const url = new URL(baseUrl);

    if (
      url.protocol !== "http:" ||
      !["localhost", "127.0.0.1"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    ) {
      throw new Error("Informe uma URL local válida.");
    }

    const routes: {
      method: string;
      path: string;
      name: string;
    }[] = [];

    for (const documentPath of DOCUMENT_PATHS) {
      try {
        const endpoint = new URL(documentPath, url);

        const response = await fetch(endpoint, {
          redirect: "error",
          signal: AbortSignal.timeout(3000),
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) continue;

        const document = schema.safeParse(
          await response.json()
        );

        if (!document.success) continue;

        for (const [path, operations] of Object.entries(
          document.data.paths
        )) {
          if (
            !path.startsWith("/") ||
            typeof operations !== "object" ||
            operations === null
          ) {
            continue;
          }

          const methods = operations as Record<
            string,
            unknown
          >;

          for (const method of METHODS) {
            if (!(method in methods)) continue;

            const operation = methods[method];

            const description =
              typeof operation === "object" &&
              operation !== null &&
              "summary" in operation &&
              typeof operation.summary === "string"
                ? operation.summary
                : path;

            routes.push({
              method: method.toUpperCase(),
              path,
              name: description,
            });
          }
        }

        return {
          success: true,
          source: documentPath,
          routes,
        };
      } catch {
      }
    }

    return {
      success: false,
      source: null,
      routes: [],
      message:
        "A aplicação não disponibiliza uma especificação OpenAPI acessível.",
    };
  }
}
