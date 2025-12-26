import axios from "axios";
import * as XLSX from "xlsx";

export async function readOperationsFromExcel(url: string) {
  const response = await axios.get(url, { responseType: "arraybuffer" });
  const workbook = XLSX.read(response.data, { type: "buffer" });

  // Regra da V1: primeira aba
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: null });
  return rows;
}
