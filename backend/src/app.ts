import express from "express";
import cors from "cors";

import { env } from "./config/env";
import healthRoutes from "./routes/healthRoutes";
import scenarioRoutes from "./routes/scenarioRoutes";
import routeRoutes from "./routes/routeRoutes";
import integrationRoutes from "./routes/integrationRoutes";
import runRoutes from "./routes/runRoutes";
import mlLabRoutes from "./routes/mlLabRoutes";
import discoveryRoutes from "./routes/discoveryRoutes";
import sqlInjectionTestRoutes from "./routes/sqlInjectionTestRoutes";
import securityEvaluationRoutes from "./routes/securityEvaluationRoutes";

import { errorHandler } from "./middlewares/errorHandler";

export const app = express();

app.use(cors({
  origin: env.FRONTEND_URL,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
}));

app.use(express.json({ limit: "100kb" }));

app.use("/api", healthRoutes);
app.use("/api", scenarioRoutes);
app.use("/api", routeRoutes);
app.use("/api", integrationRoutes);
app.use("/api", runRoutes);
app.use("/api", mlLabRoutes);
app.use("/api", discoveryRoutes);
app.use("/api", sqlInjectionTestRoutes);
app.use("/api", securityEvaluationRoutes);

app.use(errorHandler);
