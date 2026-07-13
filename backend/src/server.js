import { config } from "./config.js";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth.js";
import fichasRoutes from "./routes/fichas.js";
import usersRoutes from "./routes/users.js";
import analyticsRoutes from "./routes/analytics.js";
import statsRoutes from "./routes/stats.js";

const app = express();

// Atrás do Nginx (reverse proxy) — necessário para req.ip/X-Forwarded-For corretos.
app.set("trust proxy", 1);

app.use(helmet());
app.use(express.json({ limit: "1mb" }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", apiLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/fichas", fichasRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/stats", statsRoutes);

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use((req, res) => res.status(404).json({ error: "Rota não encontrada." }));

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Erro interno do servidor." });
});

app.listen(config.port, "127.0.0.1", () => {
  console.log(`Protocolo Sepse backend rodando em http://127.0.0.1:${config.port}`);
});
