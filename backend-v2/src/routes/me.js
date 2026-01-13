"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/me.ts
const express_1 = require("express");
const auth_1 = require("./auth");
const supabase_1 = require("../lib/supabase");
const router = (0, express_1.Router)();
/**
 * GET /me
 * Retorna dados do usuário logado a partir do party_id do token.
 */
router.get("/me", auth_1.requireAuth, async (req, res) => {
    try {
        const user = req.user;
        const partyId = String(user?.party_id ?? "").trim();
        if (!partyId) {
            return res.status(401).json({ ok: false, error: "NO_PARTY_ID_IN_TOKEN" });
        }
        const { data: party, error } = await supabase_1.supabaseAdmin
            .from("omie_parties")
            .select("id, name, cpf_cnpj, omie_code")
            .eq("id", partyId)
            .maybeSingle();
        if (error) {
            return res.status(500).json({ ok: false, error: "DB_ERROR", details: error.message });
        }
        if (!party) {
            return res.status(404).json({ ok: false, error: "PARTY_NOT_FOUND" });
        }
        const fullName = String(party.name ?? "").trim();
        const firstName = fullName ? fullName.split(/\s+/)[0] : "";
        return res.json({
            ok: true,
            party: {
                id: party.id,
                name: fullName,
                firstName,
                cpf_cnpj: party.cpf_cnpj ?? null,
                omie_code: party.omie_code ?? null,
            },
        });
    }
    catch (err) {
        return res.status(500).json({
            ok: false,
            error: "INTERNAL_ERROR",
            details: err?.message ?? String(err),
        });
    }
});
exports.default = router;
