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
exports.readNotificationsExcel = readNotificationsExcel;
exports.readNotificationsFromExcel = readNotificationsFromExcel;
const XLSX = __importStar(require("xlsx"));
function getNotificationsSheetUrl() {
    // prioridade: LOGIN_SHEET_URL (como você já tem no env)
    const url = process.env.LOGIN_SHEET_URL || process.env.EXCEL_URL;
    if (!url) {
        throw new Error("LOGIN_SHEET_URL (ou EXCEL_URL) não configurado no .env");
    }
    return String(url).trim();
}
/**
 * ✅ Função que o cron chama (sem parâmetro)
 * Lê a URL do .env e baixa a planilha.
 */
async function readNotificationsExcel() {
    const url = getNotificationsSheetUrl();
    return readNotificationsFromExcel(url);
}
/**
 * ✅ Mantém a função antiga (com parâmetro), para reuso/teste.
 */
async function readNotificationsFromExcel(excelUrl) {
    if (!excelUrl)
        throw new Error("excelUrl vazio/undefined");
    const resp = await fetch(excelUrl);
    if (!resp.ok) {
        throw new Error(`Falha ao baixar Excel (${resp.status})`);
    }
    const arrayBuffer = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheet = wb.Sheets["Ultimas Notificações"];
    if (!sheet) {
        const available = wb.SheetNames?.join(", ") || "(nenhuma)";
        throw new Error(`Aba "Ultimas Notificações" não encontrada. Abas disponíveis: ${available}`);
    }
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
    return rows;
}
