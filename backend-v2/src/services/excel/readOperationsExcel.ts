import axios from "axios";
import * as XLSX from "xlsx";

function mustGetExcelUrl(explicitUrl?: string) {
  const url =
    explicitUrl?.trim() ||
    process.env.LOGIN_SHEET_URL?.trim() ||
    process.env.EXCEL_URL?.trim();

  if (!url) {
    throw new Error("LOGIN_SHEET_URL (ou EXCEL_URL) não configurado no env");
  }

  // Valida URL de verdade (isso evita o "Invalid URL" confuso)
  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid URL (excel): ${url}`);
  }

  return url;
}

/**
 * Lê a planilha de Operations.
 * Regra V1: primeira aba do arquivo.
 */
export async function readOperationsExcel(url?: string) {
  const excelUrl = mustGetExcelUrl(url);

  const response = await axios.get(excelUrl, { responseType: "arraybuffer" });
  const workbook = XLSX.read(response.data, { type: "buffer" });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: null });

  return rows;
}

// compat: se alguma parte do código importar outro nome antigo
export async function readOperationsFromExcel(url?: string) {
  return readOperationsExcel(url);
}

export default readOperationsExcel;
