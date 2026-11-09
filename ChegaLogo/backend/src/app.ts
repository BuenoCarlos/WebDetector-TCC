import express from "express";
import cors from "cors";

import { env } from "./config/env";

import healthRoutes from "./routes/healthRoutes";
import authRoutes from "./routes/authRoutes";
import deliveryRoutes from "./routes/deliveryRoutes";
import trackingRoutes from "./routes/trackingRoutes";

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