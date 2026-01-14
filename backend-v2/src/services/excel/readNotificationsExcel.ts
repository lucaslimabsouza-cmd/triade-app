import * as XLSX from "xlsx";

type Row = Record<string, any>;

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
export async function readNotificationsExcel(): Promise<Row[]> {
  const url = getNotificationsSheetUrl();
  return readNotificationsFromExcel(url);
}

/**
 * ✅ Mantém a função antiga (com parâmetro), para reuso/teste.
 */
export async function readNotificationsFromExcel(excelUrl: string): Promise<Row[]> {
  if (!excelUrl) throw new Error("excelUrl vazio/undefined");

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

  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: null });
  return rows;
}
