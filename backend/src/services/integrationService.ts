
import { supabase } from "../config/supabase";

export class IntegrationService {
  async checkScenarioRoute(
    scenarioId: string,
    routeId: string
  ) {
    const { data: scenario, error: scenarioError } =
      await supabase
        .from("scenarios")
        .select("id, name, base_url, request_timeout_ms")
        .eq("id", scenarioId)
        .maybeSingle();

    if (scenarioError) {
      throw new Error(scenarioError.message);
    }

    if (!scenario) {
      throw new Error("SCENARIO_NOT_FOUND");
    }

    const { data: route, error: routeError } =
      await supabase
        .from("scenario_routes")
        .select("id, scenario_id, path, method, enabled")
        .eq("id", routeId)
        .eq("scenario_id", scenarioId)
        .maybeSingle();

    if (routeError) {
      throw new Error(routeError.message);
    }

    if (!route) {
      throw new Error("ROUTE_NOT_FOUND");
    }

    if (!route.enabled) {
      throw new Error("ROUTE_DISABLED");
    }

    if (
      route.method !== "GET" ||
      !/^\/api\/tracking\/CHG[0-9]{8}$/.test(route.path)
    ) {
      throw new Error("UNSUPPORTED_TEST_ROUTE");
    }

    const baseUrl = new URL(scenario.base_url);

    const allowedOrigins = [
      "http://localhost:8000",
      "http://127.0.0.1:8000",
    ];

    if (
      !allowedOrigins.includes(baseUrl.origin) ||
      baseUrl.pathname !== "/" ||
      baseUrl.search ||
      baseUrl.hash ||
      baseUrl.username ||
      baseUrl.password
    ) {
      throw new Error("TARGET_NOT_ALLOWED");
    }

    const targetUrl = new URL(route.path, baseUrl);

    const timeoutMs = Math.min(
      Math.max(Number(scenario.request_timeout_ms) || 5000, 1000),
      10000
    );

    const controller = new AbortController();
    const startedAt = performance.now();

    const timeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(targetUrl, {
        method: "GET",
        signal: controller.signal,
        redirect: "error",
        headers: {
          Accept: "application/json",
        },
      });

      const durationMs = performance.now() - startedAt;

      const contentType =
        response.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        throw new Error("INVALID_TARGET_RESPONSE");
      }

      const result = await response.json();

      return {
        success: response.ok && result.success === true,
        scenario: {
          id: scenario.id,
          name: scenario.name,
        },
        route: {
          id: route.id,
          path: route.path,
          method: route.method,
        },
        target: targetUrl.toString(),
        statusCode: response.status,
        durationMs: Number(durationMs.toFixed(2)),
        response: result,
        timestamp: new Date().toISOString(),
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
