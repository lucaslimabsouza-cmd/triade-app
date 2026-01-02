import * as XLSX from "xlsx";

type Row = Record<string, any>;

export async function readNotificationsFromExcel(excelUrl: string): Promise<Row[]> {
  const resp = await fetch(excelUrl);
  if (!resp.ok) {
    throw new Error(`Falha ao baixar Excel (${resp.status})`);
  }

  const arrayBuffer = await resp.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const wb = XLSX.read(buffer, { type: "buffer" });

  const sheet = wb.Sheets["Ultimas Notificações"];
  if (!sheet) {
    throw new Error('Aba "Ultimas Notificações" não encontrada no Excel');
  }

  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: null });
  return rows;
}
