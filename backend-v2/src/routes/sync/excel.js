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
const readOperationsExcel_1 = require("../../services/excel/readOperationsExcel");
const readNotificationsExcel_1 = require("../../services/excel/readNotificationsExcel");
const supabase_1 = require("../../lib/supabase");
const XLSX = __importStar(require("xlsx"));
const router = (0, express_1.Router)();
router.get("/_test", (_req, res) => res.json({ ok: true, route: "excel-sync" }));
/**
 * =========================
 * HELPERS – OPERATIONS
 * =========================
 */
/**
 * Converte valores de data vindos do XLSX para "YYYY-MM-DD" ou null.
 */
function toDateISO(value) {
    if (value === null || value === undefined || value === "")
        return null;
    if (value instanceof Date && !isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10);
    }
    if (typeof value === "number") {
        const parsed = XLSX.SSF.parse_date_code(value);
        if (!parsed)
            return null;
        const yyyy = String(parsed.y).padStart(4, "0");
        const mm = String(parsed.m).padStart(2, "0");
        const dd = String(parsed.d).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }
    const s = String(value).trim();
    if (!s)
        return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s))
        return s;
    const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (br) {
        return `${br[3]}-${br[2]}-${br[1]}`;
    }
    const t = Date.parse(s);
    if (!isNaN(t))
        return new Date(t).toISOString().slice(0, 10);
    return null;
}
/** Converte número/strings monetárias para number ou null */
function toNumber(value) {
    if (value === null || value === undefined || value === "")
        return null;
    if (typeof value === "number")
        return isFinite(value) ? value : null;
    const s = String(value)
        .replace(/\s/g, "")
        .replace("R$", "")
        .replace(/\./g, "")
        .replace(",", ".");
    const n = Number(s);
    return isFinite(n) ? n : null;
}
/** Extrai "SCP0105" de uma string tipo "SCP0105 Ribeirão Preto" */
function extractSCP(description) {
    const desc = String(description ?? "");
    const match = desc.match(/(SCP\d{4})/i);
    return match ? match[1].toUpperCase() : null;
}
/**
 * ✅ Normaliza URL de imagem do Google Drive para URL direta
 * (funciona com React Native <Image uri=...>)
 */
function normalizeDriveImageUrl(raw) {
    const url = String(raw ?? "").trim();
    if (!url)
        return null;
    // Já está no formato direto
    if (url.includes("drive.google.com/uc?export=download&id="))
        return url;
    // Formato: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
    const m1 = url.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
    if (m1?.[1])
        return `https://drive.google.com/uc?export=download&id=${m1[1]}`;
    // Formato: https://drive.google.com/open?id=FILE_ID
    // ou qualquer URL com ?id=FILE_ID
    const m2 = url.match(/[?&]id=([^&]+)/i);
    if (m2?.[1])
        return `https://drive.google.com/uc?export=download&id=${m2[1]}`;
    // fallback (caso já seja um link direto de outro lugar)
    return url;
}
/**
 * =========================
 * HELPERS – NOTIFICATIONS
 * =========================
 */
function toDateTimeISO(value) {
    if (value === null || value === undefined || value === "")
        return null;
    if (value instanceof Date && !isNaN(value.getTime())) {
        return value.toISOString();
    }
    if (typeof value === "number") {
        const parsed = XLSX.SSF.parse_date_code(value);
        if (!parsed)
            return null;
        const yyyy = String(parsed.y).padStart(4, "0");
        const mm = String(parsed.m).padStart(2, "0");
        const dd = String(parsed.d).padStart(2, "0");
        const hh = String(parsed.H ?? 0).padStart(2, "0");
        const mi = String(parsed.M ?? 0).padStart(2, "0");
        const ss = String(parsed.S ?? 0).padStart(2, "0");
        return new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`).toISOString();
    }
    const s = String(value).trim();
    if (!s)
        return null;
    const t = Date.parse(s);
    if (!isNaN(t))
        return new Date(t).toISOString();
    const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (br) {
        const hh = br[4] ?? "00";
        const mi = br[5] ?? "00";
        const ss = br[6] ?? "00";
        return new Date(`${br[3]}-${br[2]}-${br[1]}T${hh}:${mi}:${ss}Z`).toISOString();
    }
    return null;
}
function toNullIfEmpty(v) {
    const s = String(v ?? "").trim();
    return s.length ? s : null;
}
function toBoolEnviarPush(v) {
    return String(v ?? "").trim().toLowerCase() === "sim";
}
/**
 * =========================
 * OPERATIONS
 * =========================
 */
router.post("/operations", async (_req, res) => {
    try {
        const excelUrl = process.env.EXCEL_URL;
        if (!excelUrl) {
            return res
                .status(500)
                .json({ ok: false, error: "EXCEL_URL não configurada no .env" });
        }
        const rows = await (0, readOperationsExcel_1.readOperationsFromExcel)(excelUrl);
        let imported = 0;
        let skippedNoCode = 0;
        let failed = 0;
        for (const row of rows) {
            const desc = row["Descrição do Imóvel"];
            const code = extractSCP(desc);
            if (!code) {
                skippedNoCode++;
                continue;
            }
            const photoUrl = normalizeDriveImageUrl(row["Link Foto do imóvel"] ??
                row["Link da foto"] ??
                row["Foto do Imóvel"] ??
                row["Foto"] ??
                row["photo_url"]);
            const payload = {
                code,
                name: desc ?? "Operação",
                city: row["Cidade"] ?? null,
                state: row["Estado"] ?? null,
                status: row["Status"] ?? "em_andamento",
                expected_profit: toNumber(row["Lucro esperado"]),
                expected_roi: toNumber(row["Roi esperado"]),
                estimated_term_months: toNumber(row["Prazo estimado"]),
                realized_term_months: toNumber(row["Prazo realizado"]),
                auction_date: toDateISO(row["Data Arrematação"]),
                itbi_date: toDateISO(row["Data ITBI"]),
                deed_date: toDateISO(row["Data Escritura de compra e venda"]),
                registry_date: toDateISO(row["Data Matrícula"]),
                vacancy_date: toDateISO(row["Data desocupação"]),
                construction_date: toDateISO(row["Data Obra"]),
                listed_to_broker_date: toDateISO(row["Data Disponibilizado para imobiliária"]),
                sale_contract_date: toDateISO(row["Data contrato de venda"]),
                sale_receipt_date: toDateISO(row["Data recebimento da venda"]),
                link_arrematacao: row["Link Carta de arrematação"] ?? null,
                link_matricula: row["Link Matricula consolidada"] ?? null,
                link_contrato_scp: row["Link Contrato Scp"] ?? null,
                // ✅ COLUNA CERTA (conforme sua tabela): photo_url
                photo_url: photoUrl,
            };
            const { error } = await supabase_1.supabaseAdmin
                .from("operations")
                .upsert(payload, { onConflict: "code" });
            if (error)
                failed++;
            else
                imported++;
        }
        return res.json({
            ok: true,
            imported,
            failed,
            skippedNoCode,
            totalRows: rows.length,
        });
    }
    catch (err) {
        console.error("❌ [sync/excel/operations] route error:", err);
        return res.status(500).json({
            ok: false,
            error: err?.message ?? "Erro desconhecido no sync do Excel",
        });
    }
});
router.get("/operations", (_req, res) => {
    res.json({ ok: true, hint: "Use POST /sync/excel/operations para sincronizar" });
});
/**
 * =========================
 * NOTIFICATIONS
 * =========================
 */
router.post("/notifications", async (_req, res) => {
    try {
        const excelUrl = process.env.EXCEL_URL;
        if (!excelUrl) {
            return res
                .status(500)
                .json({ ok: false, error: "EXCEL_URL não configurada no .env" });
        }
        const rows = await (0, readNotificationsExcel_1.readNotificationsFromExcel)(excelUrl);
        let imported = 0;
        let skippedInvalid = 0;
        let failed = 0;
        for (const row of rows) {
            const sourceId = row["ID"];
            const dataHora = row["DataHora"];
            const msgCurta = row["MensagemCurta"];
            if (!sourceId || !dataHora || !msgCurta) {
                skippedInvalid++;
                continue;
            }
            const payload = {
                source_id: Number(sourceId),
                datahora: toDateTimeISO(dataHora),
                codigo_imovel: toNullIfEmpty(row["CodigoImovel"]),
                mensagem_curta: String(msgCurta).trim(),
                mensagem_detalhada: toNullIfEmpty(row["MensagemDetalhada"]),
                tipo: toNullIfEmpty(row["Tipo"]),
                enviar_push: toBoolEnviarPush(row["EnviarPush"]),
            };
            if (!payload.datahora) {
                skippedInvalid++;
                continue;
            }
            const { error } = await supabase_1.supabaseAdmin
                .from("notifications")
                .upsert(payload, { onConflict: "source_id" });
            if (error)
                failed++;
            else
                imported++;
        }
        return res.json({
            ok: true,
            imported,
            failed,
            skippedInvalid,
            totalRows: rows.length,
        });
    }
    catch (err) {
        console.error("❌ [sync/excel/notifications] route error:", err);
        return res.status(500).json({
            ok: false,
            error: err?.message ?? "Erro desconhecido no sync de notifications",
        });
    }
});
router.get("/notifications", (_req, res) => {
    res.json({
        ok: true,
        hint: "Use POST /sync/excel/notifications para sincronizar",
    });
});
exports.default = router;
