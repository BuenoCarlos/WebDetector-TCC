import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
    layout("layouts/layoutPadrao.tsx", [
    index("routes/dashboard.tsx"),
    route("configCenario", "routes/configCenario.tsx"),
    route("execucao","routes/execucao.tsx"),
    route("monitoramento", "routes/monitoramento.tsx"),
    route("compararCenarios", "routes/compararCenarios.tsx"),
    route("relatorios", "routes/relatorios.tsx"),
]),
] satisfies RouteConfig;