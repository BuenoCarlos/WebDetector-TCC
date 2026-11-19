import sastRoutes from "./routes/sastRoutes";
import express from "express";
import cors from "cors";

import { env } from "./config/env";
import healthRoutes from "./routes/healthRoutes";
import scenarioRoutes from "./routes/scenarioRoutes";
import discoveryRoutes from "./routes/discoveryRoutes";
import securityEvaluationRoutes from "./routes/securityEvaluationRoutes";
import applicationScanRoutes from "./routes/applicationScanRoutes";

import { errorHandler } from "./middlewares/errorHandler";

export const app = express();

app.use(cors({
  origin: env.FRONTEND_URL,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
}));

app.use(express.json({ limit: "100kb" }));

app.use("/api", healthRoutes);
app.use("/api", scenarioRoutes);;
app.use("/api", discoveryRoutes);
app.use("/api", securityEvaluationRoutes);
app.use("/api", applicationScanRoutes);

app.use("/api", sastRoutes);

app.use(errorHandler);
