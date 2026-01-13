"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/notifications.ts
const express_1 = require("express");
const auth_1 = require("./auth");
const supabase_1 = require("../lib/supabase");
const router = (0, express_1.Router)();
/** helpers */
function uniq(arr) {
    return Array.from(new Set(arr));
}
function s(v) {
    return String(v ?? "").trim();
}
function safeStrOrNull(v) {
    const x = s(v);
    return x ? x : null;
}
async function getCodProjetosByParty(party) {
    const cpfCnpj = s(party.cpf_cnpj);
    const omieCode = s(party.omie_code);
    if (omieCode) {
        const { data, error } = await supabase_1.supabaseAdmin
            .from("omie_mf_movements")
            .select("cod_projeto")
            .eq("cod_cliente", omieCode);
        if (error)
            throw new Error(error.message);
        return uniq((data ?? []).map((r) => s(r?.cod_projeto)).filter(Boolean));
    }
    if (cpfCnpj) {
        const { data } = await supabase_1.supabaseAdmin
            .from("omie_mf_movements")
            .select("cod_projeto")
            .or(`cpf.eq.${cpfCnpj},cpf_cnpj.eq.${cpfCnpj}`);
        return uniq((data ?? []).map((r) => s(r?.cod_projeto)).filter(Boolean));
    }
    return [];
}
async function getProjectNamesByCodProjetos(codProjetos) {
    if (!codProjetos.length)
        return [];
    const { data, error } = await supabase_1.supabaseAdmin
        .from("omie_projects")
        .select("name")
        .in("omie_internal_code", codProjetos);
    if (error)
        throw new Error(error.message);
    return uniq((data ?? []).map((p) => s(p?.name)).filter(Boolean));
}
async function fetchNotificationsForParty(party) {
    const codProjetos = await getCodProjetosByParty(party);
    const projectNames = await getProjectNamesByCodProjetos(codProjetos);
    let query = supabase_1.supabaseAdmin
        .from("notifications")
        .select("*")
        .order("datahora", { ascending: false })
        .limit(200);
    if (projectNames.length > 0) {
        const inList = projectNames.map((n) => `"${n}"`).join(",");
        query = query.or(`codigo_imovel.is.null,codigo_imovel.in.(${inList})`);
    }
    else {
        query = query.is("codigo_imovel", null);
    }
    const { data, error } = await query;
    if (error)
        throw new Error(error.message);
    return data ?? [];
}
/**
 * GET /notifications
 */
router.get("/", auth_1.requireAuth, async (req, res) => {
    try {
        const partyId = s(req.user?.party_id);
        const { data: party } = await supabase_1.supabaseAdmin
            .from("omie_parties")
            .select("id, name, cpf_cnpj, omie_code")
            .eq("id", partyId)
            .maybeSingle();
        if (!party)
            return res.status(404).json({ ok: false });
        const notifications = await fetchNotificationsForParty(party);
        res.json({ ok: true, notifications });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});
/**
 * GET /notifications/unread-count
 */
router.get("/unread-count", auth_1.requireAuth, async (req, res) => {
    try {
        const partyId = s(req.user?.party_id);
        const { data: party } = await supabase_1.supabaseAdmin
            .from("omie_parties")
            .select("id, cpf_cnpj, omie_code")
            .eq("id", partyId)
            .maybeSingle();
        if (!party)
            return res.json({ ok: true, unread: 0 });
        const notifications = await fetchNotificationsForParty(party);
        const ids = notifications.map((n) => n.id);
        const { data: reads } = await supabase_1.supabaseAdmin
            .from("notification_reads")
            .select("notification_id")
            .eq("party_id", partyId)
            .in("notification_id", ids);
        const readSet = new Set((reads ?? []).map((r) => r.notification_id));
        const unread = ids.filter((id) => !readSet.has(id)).length;
        res.json({ ok: true, unread });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});
/**
 * POST /notifications/mark-read
 */
router.post("/mark-read", auth_1.requireAuth, async (req, res) => {
    try {
        const partyId = s(req.user?.party_id);
        const { data: party } = await supabase_1.supabaseAdmin
            .from("omie_parties")
            .select("id, cpf_cnpj, omie_code")
            .eq("id", partyId)
            .maybeSingle();
        if (!party)
            return res.json({ ok: true, marked: 0 });
        const notifications = await fetchNotificationsForParty(party);
        const ids = notifications.map((n) => n.id);
        const rows = ids.map((id) => ({
            party_id: partyId,
            notification_id: id,
            read_at: new Date().toISOString(),
        }));
        await supabase_1.supabaseAdmin
            .from("notification_reads")
            .upsert(rows, { onConflict: "party_id,notification_id" });
        res.json({ ok: true, marked: ids.length });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});
exports.default = router;
