"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
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
const me_1 = __importDefault(require("./routes/me"));
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
// ✅ Log de request + status
app.use((req, res, next) => {
    const t0 = Date.now();
    res.on("finish", () => {
        console.log(`[REQ] ${req.method} ${req.path} -> ${res.statusCode} (${Date.now() - t0}ms)`);
    });
    next();
});
/* =========================
   Rotas públicas
========================= */
app.use("/health", health_1.default);
// ✅ ping (pra teste rápido)
app.get("/ping", (_req, res) => {
    return res.json({ ok: true, ts: new Date().toISOString() });
});
/* =========================
   Rotas de sincronização
========================= */
app.use("/sync/excel", excel_1.default);
app.use("/sync/omie", omie_1.default);
/* =========================
   Autenticação
========================= */
app.use("/auth", auth_1.default);
/**
 * ✅ Compatibilidade: builds antigos chamam POST /login
 * Isso reaproveita o mesmo authRouter, assumindo que nele existe router.post("/login").
 */
app.post("/login", (req, res, next) => {
    // garante que o router receba o path que ele espera
    req.url = "/login";
    return auth_1.default(req, res, next);
});
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
