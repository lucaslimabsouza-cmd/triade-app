"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../lib/supabase");
const expo_server_sdk_1 = require("expo-server-sdk");
const NotificationsExcel = __importStar(require("../services/excel/readNotificationsExcel"));
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
function pickFn(mod, preferredName) {
    if (typeof mod?.[preferredName] === "function")
        return mod[preferredName];
    if (typeof mod?.default === "function")
        return mod.default;
    for (const k of Object.keys(mod || {})) {
        if (typeof mod[k] === "function")
            return mod[k];
    }
    return null;
}
function normalizeSim(v) {
    return String(v ?? "").trim().toLowerCase() === "sim";
}
function mustHaveSheetUrl() {
    // ✅ aceita os dois nomes, mas prioriza LOGIN_SHEET_URL
    const url = process.env.LOGIN_SHEET_URL || process.env.EXCEL_URL;
    if (!url) {
        throw new Error("LOGIN_SHEET_URL (ou EXCEL_URL) não configurado no env");
    }
    return url;
}
async function sendPushToCpfs(cpfs, title, body) {
    // ⚠️ depende da existência da tabela push_tokens
    const { data, error } = await supabase_1.supabaseAdmin
        .from("push_tokens")
        .select("cpf, expo_push_token")
        .in("cpf", cpfs);
    if (error)
        throw error;
    const expo = new expo_server_sdk_1.Expo();
    const messages = (data || [])
        .map((row) => row.expo_push_token)
        .filter((t) => expo_server_sdk_1.Expo.isExpoPushToken(t))
        .map((token) => ({
        to: token,
        title,
        body,
        sound: "default",
    }));
    if (!messages.length)
        return { ok: true, sent: 0 };
    const chunks = expo.chunkPushNotifications(messages);
    let sent = 0;
    for (const chunk of chunks) {
        const tickets = await expo.sendPushNotificationsAsync(chunk);
        sent += tickets.length;
    }
    return { ok: true, sent };
}
async function resolveCpfsForNotification(codigoImovel) {
    // ⚠️ depende da existência da tabela operation_investors (ou equivalente)
    if (!codigoImovel) {
        const { data, error } = await supabase_1.supabaseAdmin.from("push_tokens").select("cpf");
        if (error)
            throw error;
        return (data || []).map((r) => r.cpf);
    }
    const { data, error } = await supabase_1.supabaseAdmin
        .from("operation_investors")
        .select("cpf")
        .eq("operation_name", codigoImovel);
    if (error)
        throw error;
    return (data || []).map((r) => r.cpf);
}
/* =========================================
   POST /cron/sync-notifications
========================================= */
router.post("/cron/sync-notifications", requireAdmin, async (req, res) => {
    try {
        // ✅ valida env antes de tudo (evita o erro “parse URL undefined”)
        mustHaveSheetUrl();
        const readNotificationsExcel = pickFn(NotificationsExcel, "readNotificationsExcel");
        console.log("[cron] notifications module exports:", Object.keys(NotificationsExcel || {}));
        if (typeof readNotificationsExcel !== "function") {
            return res.status(500).json({
                ok: false,
                error: "Não achei função de leitura da planilha. Verifique exports em src/services/excel/readNotificationsExcel.ts",
                exports: Object.keys(NotificationsExcel || {}),
            });
        }
        const items = await readNotificationsExcel();
        let inserted = 0;
        let pushQueued = 0;
        let pushSent = 0;
        for (let i = 0; i < (items || []).length; i++) {
            const n = items[i];
            // ✅ aceitando vários nomes possíveis vindos do Excel
            const datahora = n.DataHora || n.datahora || n.datetime || null;
            const codigoImovelRaw = n.CodigoImovel ?? n.codigo_imovel ?? n.codigoImovel ?? "";
            const codigo_imovel = String(codigoImovelRaw || "").trim() || null;
            const mensagem_curta = String(n.MensagemCurta ?? n.mensagem_curta ?? n.mensagemCurta ?? "").trim();
            const mensagem_detalhada = String(n.MensagemDetalhada ?? n.mensagem_detalhada ?? n.mensagemDetalhada ?? "").trim();
            const tipo = (n.Tipo ?? n.tipo ?? null) ? String(n.Tipo ?? n.tipo).trim() : null;
            const enviar_push = normalizeSim(n.EnviarPush ?? n.enviar_push ?? n.enviarPush);
            // ✅ grava na sua tabela notifications com os nomes CERTOS
            const payload = {
                source_id: String(n.SourceId ?? n.source_id ?? i + 1),
                datahora,
                codigo_imovel,
                mensagem_curta,
                mensagem_detalhada,
                tipo,
                enviar_push,
            };
            const { error } = await supabase_1.supabaseAdmin.from("notifications").insert(payload);
            if (!error)
                inserted++;
            // ✅ push opcional (se as tabelas existirem)
            if (enviar_push && mensagem_curta) {
                try {
                    pushQueued++;
                    const cpfs = await resolveCpfsForNotification(codigo_imovel);
                    if (cpfs.length) {
                        const out = await sendPushToCpfs(cpfs, "Triade", mensagem_curta);
                        pushSent += out.sent;
                    }
                }
                catch (e) {
                    console.log("[cron] push skipped/error:", e?.message || e);
                }
            }
        }
        return res.json({ ok: true, inserted, pushQueued, pushSent });
    }
    catch (e) {
        console.log("[cron/sync-notifications] error:", e?.message || e);
        return res.status(500).json({ ok: false, error: e?.message || "Erro interno" });
    }
});
exports.default = router;
