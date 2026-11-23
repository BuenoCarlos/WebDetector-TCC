import express from "express";
import cors from "cors";

import { env } from "./config/env";

import healthRoutes from "./routes/healthRoutes";
import authRoutes from "./routes/authRoutes";
import deliveryRoutes from "./routes/deliveryRoutes";
import trackingRoutes from "./routes/trackingRoutes";
import clientRoutes from "./routes/clientRoutes";
import supportRoutes from "./routes/supportRoutes";
import { openapiSpec } from "./config/openapi";
import labLoginRoutes from "./routes/labLoginRoutes";
import labXssRoutes from "./routes/labXssRoutes";

import cookieParser from "cookie-parser";

export const app = express();

app.disable("x-powered-by");

app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
}));

app.use(cookieParser());

app.use(express.json({ limit: "100kb" }));

app.use("/api", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/deliveries", deliveryRoutes);
app.use("/api/tracking", trackingRoutes);
if (env.NODE_ENV !== "production") {
  app.use("/api/lab", labLoginRoutes);
}

if (
  env.NODE_ENV === "development" &&
  process.env.WD_ENABLE_XSS_LAB === "1"
) {
  app.use("/api/lab", labXssRoutes);
}

app.use("/api/clients", clientRoutes);
app.use("/api/support", supportRoutes);

if (process.env.NODE_ENV !== "production") {
  app.get("/openapi.json", (_req, res) => {
    res.json(openapiSpec);
  });
}