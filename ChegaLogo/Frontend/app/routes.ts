import { type RouteConfig, route } from "@react-router/dev/routes";

export default [

  //publico
  route("/", "routes/tracking.tsx"),
  route("login", "routes/login.tsx"),
  route("registerUser","routes/registerUser.tsx"),
  route("client/home", "routes/clientHome.tsx"),
  route("client/support", "routes/clientSupport.tsx"),

  //administrativo
  route("admin/login", "routes/adminLogin.tsx"),
  route("admin/dashboard", "routes/home.tsx"),
  route("admin/support", "routes/adminSupport.tsx"),
] satisfies RouteConfig;

