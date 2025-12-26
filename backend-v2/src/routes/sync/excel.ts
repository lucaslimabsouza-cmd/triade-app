import { Router } from "express";
import { readOperationsFromExcel } from "../../services/excel/readOperationsExcel";
import { supabaseAdmin } from "../../lib/supabase";
import * as XLSX from "xlsx";

const router = Router();

router.get("/_test", (_req, res) =>
  res.json({ ok: true, route: "excel-sync" })
);

/**
 * Converte valores de data vindos do XLSX para "YYYY-MM-DD" ou null.
 * Pode vir como:
 * - string ("2025-01-10", "10/01/2025")
 * - número serial do Excel
 * - Date
 */
function toDateISO(value: any): string | null {
  if (value === null || value === undefined || value === "") return null;

  // Já é Date
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  // Excel serial number
  if (typeof value === "number") {
    // XLSX.SSF.parse_date_code converte serial em partes
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    const yyyy = String(parsed.y).padStart(4, "0");
    const mm = String(parsed.m).padStart(2, "0");
    const dd = String(parsed.d).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // String: tenta parse direto
  const s = String(value).trim();
  if (!s) return null;

  // Formato ISO já
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Formato BR dd/mm/yyyy
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const dd = br[1];
    const mm = br[2];
    const yyyy = br[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  // Última tentativa: Date.parse
  const t = Date.parse(s);
  if (!isNaN(t)) return new Date(t).toISOString().slice(0, 10);

  return null;
}

/** Converte número/strings monetárias para number ou null */
function toNumber(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return isFinite(value) ? value : null;

  // Trata "R$ 1.234,56" / "1.234,56" / "1234.56"
  const s = String(value)
    .replace(/\s/g, "")
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(s);
  return isFinite(n) ? n : null;
}

/** Extrai "SCP0105" de uma string tipo "SCP0105 Ribeirão Preto" */
function extractSCP(description: any): string | null {
  const desc = String(description ?? "");
  const match = desc.match(/(SCP\d{4})/i);
  return match ? match[1].toUpperCase() : null;
}

router.post("/operations", async (_req, res) => {
  try {
    const excelUrl = process.env.EXCEL_URL;
    if (!excelUrl) {
      return res
        .status(500)
        .json({ ok: false, error: "EXCEL_URL não configurada no .env" });
    }

    const rows = await readOperationsFromExcel(excelUrl);

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

      const payload: any = {
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
        listed_to_broker_date: toDateISO(
          row["Data Disponibilizado para imobiliária"]
        ),
        sale_contract_date: toDateISO(row["Data contrato de venda"]),
        sale_receipt_date: toDateISO(row["Data recebimento da venda"]),

        link_arrematacao: row["Link Carta de arrematação"] ?? null,
        link_matricula: row["Link Matricula consolidada"] ?? null,
        link_contrato_scp: row["Link Contrato SCP"] ?? null,

      };

      const { error } = await supabaseAdmin
        .from("operations")
        .upsert(payload, { onConflict: "code" });

      if (error) {
        failed++;
        // Se quiser ver o motivo no console:
        // console.error("Upsert error:", code, error.message);
      } else {
        imported++;
      }
    }

    return res.json({
      ok: true,
      imported,
      failed,
      skippedNoCode,
      totalRows: rows.length
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: err?.message ?? "Erro desconhecido no sync do Excel"
    });
  }
});

export default router;

router.get("/operations", (_req, res) => {
  res.json({ ok: true, hint: "Use POST /sync/excel/operations para sincronizar" });
});
