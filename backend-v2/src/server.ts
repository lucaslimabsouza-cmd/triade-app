import "dotenv/config";
import express from "express";
import cors from "cors";
import { logger } from "./lib/logger";

// Rotas base
import healthRouter from "./routes/health";

// Sync
import excelSyncRouter from "./routes/sync/excel";
import omieSyncRouter from "./routes/sync/omie";

// Auth
import authRouter from "./routes/auth";

// App
import operationsRouter from "./routes/operations";
import operationCostsRouter from "./routes/operation-costs";
import operationFinancialRoutes from "./routes/operation-financial";
import meRouter from "./routes/me";
import notificationsRouter from "./routes/notifications";
import pushRouter from "./routes/push";
import pushDispatchRouter from "./routes/push-dispatch";
import passwordResetRouter from "./routes/passwordReset";
import cronRoutes from "./routes/cron";
import cronSyncAllRouter from "./routes/cron-sync-all";

const app = express();

/* =========================
   Middlewares
========================= */
app.use(cors());
app.use(express.json());

// ✅ Log de request + status usando logger
app.use((req, res, next) => {
  const t0 = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - t0;
    logger.info(`${req.method} ${req.path}`, {
      status: res.statusCode,
      duration: `${duration}ms`,
    });
  });
  next();
});

/* =========================
   Rotas públicas
========================= */
app.use("/health", healthRouter);

// ✅ ping (pra teste rápido)
app.get("/ping", (_req, res) => {
  return res.json({ ok: true, ts: new Date().toISOString() });
});

/* =========================
   Rotas de sincronização
========================= */
app.use("/sync/excel", excelSyncRouter);
app.use("/sync/omie", omieSyncRouter);

/* =========================
   Autenticação
========================= */
app.use("/auth", authRouter);

/**
 * ✅ Compatibilidade: builds antigos chamam POST /login
 * Isso reaproveita o mesmo authRouter, assumindo que nele existe router.post("/login").
 */
app.post("/login", (req, res, next) => {
  // garante que o router receba o path que ele espera
  req.url = "/login";
  return (authRouter as any)(req, res, next);
});

/* =========================
   App (logado)
========================= */
app.use("/operations", operationsRouter);
app.use(operationFinancialRoutes);
app.use(meRouter);
app.use("/notifications", notificationsRouter);
app.use("/push", pushRouter);
app.use("/push", pushDispatchRouter);
app.use(passwordResetRouter);
app.use(cronRoutes);
app.use(cronSyncAllRouter);

app.use("/operation-costs", operationCostsRouter);
logger.info("Route mounted: /operation-costs");

/* =========================
   Error Handler
========================= */
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error("Erro não tratado", err);
  res.status(500).json({
    ok: false,
    error: process.env.NODE_ENV === "production" ? "Erro interno do servidor" : err.message,
  });
});

/* =========================
   Start server
========================= */
const port = Number(process.env.PORT ?? 4001);

app.listen(port, () => {
  logger.info(`Backend-v2 rodando na porta ${port}`, {
    env: process.env.NODE_ENV || "development",
  });
});
