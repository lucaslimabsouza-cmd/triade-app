"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
require("dotenv/config");
// Rotas base
const health_1 = __importDefault(require("./routes/health"));
// Sync
const excel_1 = __importDefault(require("./routes/sync/excel"));
const omie_1 = __importDefault(require("./routes/sync/omie"));
// Auth
const auth_1 = __importDefault(require("./routes/auth"));
// App
const operations_1 = __importDefault(require("./routes/operations"));
const operation_costs_1 = __importDefault(require("./routes/operation-costs"));
const operation_financial_1 = __importDefault(require("./routes/operation-financial"));
const me_1 = __importDefault(require("./routes/me")); // ajuste o caminho
const notifications_1 = __importDefault(require("./routes/notifications"));
const push_1 = __importDefault(require("./routes/push"));
const push_dispatch_1 = __importDefault(require("./routes/push-dispatch"));
const passwordReset_1 = __importDefault(require("./routes/passwordReset"));
const cron_1 = __importDefault(require("./routes/cron"));
const cron_sync_all_1 = __importDefault(require("./routes/cron-sync-all"));
const app = (0, express_1.default)();
/* =========================
   Middlewares
========================= */
app.use((0, cors_1.default)());
app.use(express_1.default.json());
/* =========================
   Rotas públicas
========================= */
app.use("/health", health_1.default);
/* =========================
   Rotas de sincronização
========================= */
app.use("/sync/excel", excel_1.default);
app.use("/sync/omie", omie_1.default);
/* =========================
   Autenticação
========================= */
app.use("/auth", auth_1.default);
/* =========================
   App (logado)
========================= */
app.use("/operations", operations_1.default);
app.use(operation_financial_1.default);
app.use(me_1.default);
app.use("/notifications", notifications_1.default);
app.use("/push", push_1.default);
app.use("/push", push_dispatch_1.default);
app.use(passwordReset_1.default);
app.use(cron_1.default);
app.use(cron_sync_all_1.default);
app.use("/operation-costs", operation_costs_1.default);
console.log("✅ route mounted: /operation-costs");
/* =========================
   Start server
========================= */
const port = Number(process.env.PORT ?? 4001);
app.listen(port, () => {
    console.log(`backend-v2 rodando na porta ${port}`);
});
