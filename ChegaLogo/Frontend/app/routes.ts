import { type RouteConfig, route, index } from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  route("home", "routes/home.tsx"),
  route("registerUser","routes/registerUser.tsx"),
  route("rastreio", "routes/tracking.tsx"),
] satisfies RouteConfig;

