import { type RouteConfig, route, index } from "@react-router/dev/routes";

export default [

  //publico
  route("/", "routes/tracking.tsx"),
  route("login", "routes/login.tsx"),
  route("registerUser","routes/registerUser.tsx"),

  //administrativo
  route("admin/login", "routes/adminLogin.tsx"),
  route("admin/dashboard", "routes/home.tsx"),
] satisfies RouteConfig;

