import express from "express";
import cors from "cors";
import "dotenv/config";

import healthRouter from "./routes/health";
import excelSyncRouter from "./routes/sync/excel";
import omieSyncRouter from "./routes/sync/omie";

// ✅ NOVO: rotas de autenticação (login / trocar senha / setar senha inicial)
import authRouter from "./routes/auth";

const app = express();
app.use(cors());
app.use(express.json());

// Rotas
app.use("/health", healthRouter);
app.use("/sync/excel", excelSyncRouter);
app.use("/sync/omie", omieSyncRouter);

// ✅ NOVO: tudo que começar com /auth vai para ./routes/auth
app.use("/auth", authRouter);

const port = Number(process.env.PORT ?? 4001);
app.listen(port, () => {
  console.log(`backend-v2 rodando na porta ${port}`);
});
