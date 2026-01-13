"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("./auth");
const supabase_1 = require("../lib/supabase");
const router = (0, express_1.Router)();
/**
 * POST /push/token
 * body: { expo_push_token: string }
 */
router.post("/token", auth_1.requireAuth, async (req, res) => {
    try {
        const user = req.user;
        const partyId = String(user?.party_id ?? "").trim();
        if (!partyId)
            return res.status(401).json({ ok: false, error: "NO_PARTY_ID_IN_TOKEN" });
        const expo_push_token = String(req.body?.expo_push_token ?? "").trim();
        if (!expo_push_token)
            return res.status(400).json({ ok: false, error: "MISSING_EXPO_PUSH_TOKEN" });
        const { error } = await supabase_1.supabaseAdmin
            .from("push_tokens")
            .upsert({ party_id: partyId, expo_push_token, updated_at: new Date().toISOString() });
        if (error)
            return res.status(500).json({ ok: false, error: "DB_ERROR", details: error.message });
        return res.json({ ok: true });
    }
    catch (err) {
        return res.status(500).json({ ok: false, error: "INTERNAL_ERROR", details: err?.message ?? String(err) });
    }
});
exports.default = router;
