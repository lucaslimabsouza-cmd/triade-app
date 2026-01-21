import { supabaseAdmin } from "../../lib/supabase";
import * as NotificationsExcel from "../excel/readNotificationsExcel";

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

function normalizeSim(v: any) {
  return s(v).toLowerCase() === "sim";
}

function excelDateToISO(v: any): string | null {
  if (v === null || v === undefined || v === "") return null;

  if (typeof v === "number" && isFinite(v)) {
    const ms = (v - 25569) * 86400 * 1000;
    const dt = new Date(ms);
    return isNaN(dt.getTime()) ? null : dt.toISOString();
  }

  const t = s(v);
  if (!t) return null;

  const dt = new Date(t);
  if (!isNaN(dt.getTime())) return dt.toISOString();

  return t;
}

export async function syncExcelNotifications() {
  const readNotificationsExcel = pickFn(NotificationsExcel, "readNotificationsExcel");
  if (typeof readNotificationsExcel !== "function") {
    throw new Error("Não achei função readNotificationsExcel em src/services/excel.");
  }

  const items = (await readNotificationsExcel()) as any[];

  let rows = 0;
  let upserted = 0;
  let skippedNoId = 0;

  const batch: any[] = [];
  const BATCH_SIZE = 500;

  async function flush() {
    if (!batch.length) return;

    const { error } = await supabaseAdmin
      .from("notifications")
      .upsert(batch, { onConflict: "source_id" });

    if (error) throw new Error(error.message);

    upserted += batch.length;
    batch.length = 0;
  }

  for (const n of items || []) {
    rows++;

    const source_id = s(n.ID ?? n.Id ?? n.id ?? n.SourceId ?? n.source_id);
    if (!source_id) {
      skippedNoId++;
      continue;
    }

    batch.push({
      source_id,
      datahora: excelDateToISO(n.DataHora ?? n.datahora ?? null),
      codigo_imovel: s(n.CodigoImovel ?? n.codigo_imovel ?? n.codigoImovel ?? "") || null,
      mensagem_curta: s(n.MensagemCurta ?? n.mensagem_curta ?? n.mensagemCurta ?? ""),
      mensagem_detalhada: s(
        n.MensagemDetalhada ?? n.mensagem_detalhada ?? n.mensagemDetalhada ?? ""
      ),
      tipo: s(n.Tipo ?? n.tipo ?? "") || null,
      enviar_push: normalizeSim(n.EnviarPush ?? n.enviar_push ?? n.enviarPush),
    });

    if (batch.length >= BATCH_SIZE) await flush();
  }

  await flush();
  return { rows, upserted, skippedNoId };
}
