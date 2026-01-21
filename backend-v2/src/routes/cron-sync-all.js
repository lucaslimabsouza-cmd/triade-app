"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const syncAll_1 = require("../services/cron/syncAll");
const router = (0, express_1.Router)();
function requireAdmin(req, res, next) {
    const got = String(req.headers["x-admin-key"] || "");
    const expected = String(process.env.ADMIN_API_KEY || "");
    if (!expected)
        return res.status(500).json({ ok: false, error: "ADMIN_API_KEY não configurada" });
    if (!got || got !== expected)
        return res.status(401).json({ ok: false, error: "Unauthorized" });
    return next();
}
router.post("/cron/sync-all", requireAdmin, async (_req, res) => {
    try {
        const result = await (0, syncAll_1.syncAll)();
        return res.json({ ok: true, ...result });
    }
    catch (e) {
        console.log("[cron/sync-all] error:", e?.message || e);
        return res.status(500).json({ ok: false, error: e?.message || "Erro interno" });
    }
});
exports.default = router;
