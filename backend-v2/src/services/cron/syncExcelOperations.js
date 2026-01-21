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
exports.syncExcelOperations = syncExcelOperations;
const supabase_1 = require("../../lib/supabase");
const OperationsExcel = __importStar(require("../excel/readOperationsExcel"));
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
function s(v) {
    return String(v ?? "").trim();
}
function excelDateToISO(v) {
    if (v === null || v === undefined || v === "")
        return null;
    // Excel serial date
    if (typeof v === "number" && isFinite(v)) {
        const ms = (v - 25569) * 86400 * 1000;
        const dt = new Date(ms);
        return isNaN(dt.getTime()) ? null : dt.toISOString();
    }
    const t = s(v);
    if (!t)
        return null;
    // aceita "6/2/2025" etc
    const dt = new Date(t);
    if (!isNaN(dt.getTime()))
        return dt.toISOString();
    return t;
}
function parseBRMoney(v) {
    const t = s(v);
    if (!t)
        return null;
    // Ex: "R$ 76.124,00"
    const cleaned = t
        .replace(/\s/g, "")
        .replace(/^R\$/i, "")
        .replace(/\./g, "")
        .replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
}
function parseBRPercent(v) {
    const t = s(v);
    if (!t)
        return null;
    // Ex: "36,00%"
    const cleaned = t.replace("%", "").replace(/\./g, "").replace(",", ".");
    const n = Number(cleaned);
    if (!Number.isFinite(n))
        return null;
    // seu banco parece guardar 0.3000 (30%)
    return n / 100;
}
function parseNumber(v) {
    const t = s(v);
    if (!t)
        return null;
    const n = Number(t.replace(",", "."));
    return Number.isFinite(n) ? n : null;
}
/**
 * Excel "Descrição do Imóvel" => operations.name
 * Ex: "SCP0109 Casa Montes Claros"
 */
function pickName(o) {
    return s(o?.["Descrição do Imóvel"] ??
        o?.["Descricao do Imovel"] ??
        o?.descricao ??
        o?.Descricao ??
        o?.name ??
        o?.Name ??
        "");
}
/**
 * Tenta extrair code (ex: SCP0109) da descrição.
 */
function extractCodeFromName(name) {
    const m = name.match(/\bSCP\d+\b/i);
    return m ? m[0].toUpperCase() : null;
}
async function syncExcelOperations() {
    const readOperationsExcel = pickFn(OperationsExcel, "readOperationsExcel");
    if (typeof readOperationsExcel !== "function") {
        throw new Error("Não achei função readOperationsExcel em src/services/excel.");
    }
    const items = (await readOperationsExcel());
    let rows = 0;
    let upserted = 0;
    let skippedNoName = 0;
    const batch = [];
    const BATCH_SIZE = 300;
    async function flush() {
        if (!batch.length)
            return;
        const { error } = await supabase_1.supabaseAdmin
            .from("operations")
            .upsert(batch, { onConflict: "name" });
        if (error)
            throw new Error(error.message);
        upserted += batch.length;
        batch.length = 0;
    }
    for (const o of items || []) {
        rows++;
        const name = pickName(o);
        if (!name) {
            skippedNoName++;
            continue;
        }
        const code = s(o?.code ?? o?.Code ?? o?.["Código"] ?? "") || extractCodeFromName(name);
        batch.push({
            // chaves / infos principais
            name,
            code: code || null,
            city: s(o?.["Cidade"] ?? o?.city ?? "") || null,
            state: s(o?.["Estado"] ?? o?.state ?? "") || null,
            status: s(o?.["Status"] ?? o?.status ?? "") || null,
            photo_url: s(o?.["photo_url"] ?? o?.photo_url ?? "") || null,
            // métricas
            expected_profit: parseBRMoney(o?.["Lucro esperado"]) ?? null,
            expected_roi: parseBRPercent(o?.["Roi esperado"]) ?? null,
            estimated_term_months: parseNumber(o?.["Prazo estimado"]) ?? null,
            realized_term_months: parseNumber(o?.["Prazo realizado"]) ?? null,
            // datas (nomes exatamente como estão no Excel)
            auction_date: excelDateToISO(o?.["Data Arrematação"]),
            itbi_date: excelDateToISO(o?.["Data ITBI"]),
            deed_date: excelDateToISO(o?.["Data Escritura de compra e venda"]),
            registry_date: excelDateToISO(o?.["Data Matrícula"]),
            vacancy_date: excelDateToISO(o?.["Data desocupação"]),
            construction_date: excelDateToISO(o?.["Data Obra"]),
            listed_to_broker_date: excelDateToISO(o?.["Data Disponibilizado para imobiliária"]),
            sale_contract_date: excelDateToISO(o?.["Data contrato de venda"]),
            // ✅ NOME CORRETO NO SUPABASE:
            sale_receipt_date: excelDateToISO(o?.["Data recebimento da venda"]),
            // links
            link_arrematacao: s(o?.["Link Carta de arrematação"]) || null,
            link_matricula: s(o?.["Link Matricula consolidada"]) || null,
            link_contrato_scp: s(o?.["Link Contrato Scp"]) || null,
            source: "excel",
            updated_at: new Date().toISOString(),
        });
        if (batch.length >= BATCH_SIZE)
            await flush();
    }
    await flush();
    return { rows, upserted, skippedNoName };
}
