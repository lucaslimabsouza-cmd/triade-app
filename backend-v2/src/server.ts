import "dotenv/config";
import express from "express";
import cors from "cors";
import "dotenv/config";

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
import meRouter from "./routes/me"; // ajuste o caminho
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

/* =========================
   Rotas públicas
========================= */
app.use("/health", healthRouter);

/* =========================
   Rotas de sincronização
========================= */
app.use("/sync/excel", excelSyncRouter);
app.use("/sync/omie", omieSyncRouter);

/* =========================
   Autenticação
========================= */
app.use("/auth", authRouter);

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
console.log("✅ route mounted: /operation-costs");



/* =========================
   Start server
========================= */
const port = Number(process.env.PORT ?? 4001);

app.listen(port, () => {
  console.log(`backend-v2 rodando na porta ${port}`);
});
