import { supabaseAdmin } from "../../lib/supabase";
import * as OperationsExcel from "../excel/readOperationsExcel";

function pickFn(mod: any, preferredName: string) {
  if (typeof mod?.[preferredName] === "function") return mod[preferredName];
  if (typeof mod?.default === "function") return mod.default;
  for (const k of Object.keys(mod || {})) {
    if (typeof (mod as any)[k] === "function") return (mod as any)[k];
  }
  return null;
}

function s(v: any) {
  return String(v ?? "").trim();
}

function excelDateToISO(v: any): string | null {
  if (v === null || v === undefined || v === "") return null;

  // Excel serial date
  if (typeof v === "number" && isFinite(v)) {
    const ms = (v - 25569) * 86400 * 1000;
    const dt = new Date(ms);
    return isNaN(dt.getTime()) ? null : dt.toISOString();
  }

  const t = s(v);
  if (!t) return null;

  const dt = new Date(t);
  if (!isNaN(dt.getTime())) return dt.toISOString();

  return t; // fallback
}

function pickOperationName(o: any): string {
  // você disse: chave = Name (mas deixo robusto)
  return s(
    o?.Name ??
      o?.name ??
      o?.NOME ??
      o?.Nome ??
      o?.CodigoImovel ??
      o?.codigo_imovel ??
      o?.Codigo ??
      o?.code ??
      ""
  );
}

export async function syncExcelOperations() {
  const readOperationsExcel = pickFn(OperationsExcel, "readOperationsExcel");
  if (typeof readOperationsExcel !== "function") {
    throw new Error("Não achei função readOperationsExcel em src/services/excel.");
  }

  const items = (await readOperationsExcel()) as any[];

  let rows = 0;
  let upserted = 0;
  let skippedNoName = 0;

  const batch: any[] = [];
  const BATCH_SIZE = 300;

  async function flush() {
    if (!batch.length) return;

    const { error } = await supabaseAdmin.from("operations").upsert(batch, {
      onConflict: "name",
    });
    if (error) throw new Error(error.message);

    // OBS: Supabase não retorna “quantos realmente mudou”, então contamos tentativas.
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

      // ⚠️ Ajuste aqui se seus cabeçalhos forem diferentes.
      auction_date: excelDateToISO(o.auction_date ?? o.AuctionDate ?? o.Arrematacao ?? o.Arrematação),
      itbi_date: excelDateToISO(o.itbi_date ?? o.ITBI ?? o.ItbiDate ?? o["pagamento do ITBI"]),
      deed_date: excelDateToISO(o.deed_date ?? o.DeedDate ?? o.Escritura ?? o["Escritura de compra e venda"]),
      registry_date: excelDateToISO(o.registry_date ?? o.RegistryDate ?? o.Registro ?? o["registro em matrícula"]),
      vacancy_date: excelDateToISO(o.vacancy_date ?? o.VacancyDate ?? o.Desocupacao ?? o.Desocupação),
      construction_date: excelDateToISO(o.construction_date ?? o.ConstructionDate ?? o.Obra ?? o.Reforma),
      listed_to_broker_date: excelDateToISO(
        o.listed_to_broker_date ??
          o.ListedToBrokerDate ??
          o.Imobiliaria ??
          o["Disponibilizado para imobiliária"]
      ),
      sale_contract_date: excelDateToISO(o.sale_contract_date ?? o.SaleContractDate ?? o["contrato de venda"]),
      sale_reciept_date: excelDateToISO(o.sale_reciept_date ?? o.SaleRecieptDate ?? o["recebimento da venda"]),
    });

    if (batch.length >= BATCH_SIZE) await flush();
  }

  await flush();

  return { rows, upserted, skippedNoName };
}
