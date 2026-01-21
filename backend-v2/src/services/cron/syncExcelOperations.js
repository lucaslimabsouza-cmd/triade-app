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
    const dt = new Date(t);
    if (!isNaN(dt.getTime()))
        return dt.toISOString();
    return t;
}
/**
 * ✅ Name no Supabase vem de "Descrição do Imóvel" no Excel
 * (mantém fallbacks caso algum dia você mude o cabeçalho)
 */
function pickOperationName(o) {
    return s(o?.["Descrição do Imóvel"] ??
        o?.["Descricao do Imovel"] ??
        o?.["DESCRIÇÃO DO IMÓVEL"] ??
        o?.["DESCRICAO DO IMOVEL"] ??
        o?.descricao_imovel ??
        o?.descricaoDoImovel ??
        o?.Descricao ??
        o?.descricao ??
        o?.Name ??
        o?.name ??
        "");
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
        // Conta tentativas enviadas ao upsert (não “linhas realmente alteradas”)
        upserted += batch.length;
        batch.length = 0;
    }
    for (const o of items || []) {
        rows++;
        const name = pickOperationName(o);
        if (!name) {
            skippedNoName++;
            continue;
        }
        batch.push({
            name,
            auction_date: excelDateToISO(o.auction_date ?? o.AuctionDate ?? o.Arrematacao ?? o.Arrematação),
            itbi_date: excelDateToISO(o.itbi_date ?? o.ITBI ?? o.ItbiDate ?? o["pagamento do ITBI"]),
            deed_date: excelDateToISO(o.deed_date ?? o.DeedDate ?? o.Escritura ?? o["Escritura de compra e venda"]),
            registry_date: excelDateToISO(o.registry_date ?? o.RegistryDate ?? o.Registro ?? o["registro em matrícula"]),
            vacancy_date: excelDateToISO(o.vacancy_date ?? o.VacancyDate ?? o.Desocupacao ?? o.Desocupação),
            construction_date: excelDateToISO(o.construction_date ?? o.ConstructionDate ?? o.Obra ?? o.Reforma),
            listed_to_broker_date: excelDateToISO(o.listed_to_broker_date ??
                o.ListedToBrokerDate ??
                o.Imobiliaria ??
                o["Disponibilizado para imobiliária"]),
            sale_contract_date: excelDateToISO(o.sale_contract_date ?? o.SaleContractDate ?? o["contrato de venda"]),
            sale_reciept_date: excelDateToISO(o.sale_reciept_date ?? o.SaleRecieptDate ?? o["recebimento da venda"]),
        });
        if (batch.length >= BATCH_SIZE)
            await flush();
    }
    await flush();
    return { rows, upserted, skippedNoName };
}
