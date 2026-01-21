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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readOperationsExcel = readOperationsExcel;
exports.readOperationsFromExcel = readOperationsFromExcel;
const axios_1 = __importDefault(require("axios"));
const XLSX = __importStar(require("xlsx"));
function mustGetExcelUrl(explicitUrl) {
    const url = explicitUrl?.trim() ||
        process.env.LOGIN_SHEET_URL?.trim() ||
        process.env.EXCEL_URL?.trim();
    if (!url) {
        throw new Error("LOGIN_SHEET_URL (ou EXCEL_URL) não configurado no env");
    }
    // Valida URL de verdade (isso evita o "Invalid URL" confuso)
    try {
        new URL(url);
    }
    catch {
        throw new Error(`Invalid URL (excel): ${url}`);
    }
    return url;
}
/**
 * Lê a planilha de Operations.
 * Regra V1: primeira aba do arquivo.
 */
async function readOperationsExcel(url) {
    const excelUrl = mustGetExcelUrl(url);
    const response = await axios_1.default.get(excelUrl, { responseType: "arraybuffer" });
    const workbook = XLSX.read(response.data, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName)
        return [];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
    return rows;
}
// compat: se alguma parte do código importar outro nome antigo
async function readOperationsFromExcel(url) {
    return readOperationsExcel(url);
}
exports.default = readOperationsExcel;
