import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase";
import * as NotificationsExcel from "../services/excel/readNotificationsExcel";

const router = Router();

function requireAdmin(req: any, res: any, next: any) {
  const got = String(req.headers["x-admin-key"] || "");
  const expected = String(process.env.ADMIN_API_KEY || "");
  if (!expected) return res.status(500).json({ ok: false, error: "ADMIN_API_KEY não configurada" });
  if (!got || got !== expected) return res.status(401).json({ ok: false, error: "Unauthorized" });
  return next();
}

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

function mustHaveSheetUrl() {
  const url = process.env.LOGIN_SHEET_URL || process.env.EXCEL_URL;
  if (!url) throw new Error("LOGIN_SHEET_URL (ou EXCEL_URL) não configurado no env");
  return url;
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

/**
 * POST /cron/sync-notifications
 * - Lê planilha
 * - UPSERT em notifications por source_id
 * - NÃO envia push aqui
 */
router.post("/cron/sync-notifications", requireAdmin, async (_req, res) => {
  try {
    mustHaveSheetUrl();

    const readNotificationsExcel = pickFn(NotificationsExcel, "readNotificationsExcel");

    console.log("[cron] notifications module exports:", Object.keys(NotificationsExcel || {}));

    if (typeof readNotificationsExcel !== "function") {
      return res.status(500).json({
        ok: false,
        error: "Não achei função de leitura da planilha (readNotificationsExcel).",
        exports: Object.keys(NotificationsExcel || {}),
      });
    }

    const items = (await readNotificationsExcel()) as any[];

    let rows = 0;
    let upserted = 0;
    let skippedNoId = 0;

    for (const n of items || []) {
      rows++;

      const source_id = s(n.ID ?? n.Id ?? n.id);
      if (!source_id) {
        skippedNoId++;
        continue;
      }

      const payload = {
        source_id,
        datahora: excelDateToISO(n.DataHora ?? n.datahora ?? null),
        codigo_imovel: s(n.CodigoImovel ?? n.codigo_imovel ?? n.codigoImovel ?? "") || null,
        mensagem_curta: s(n.MensagemCurta ?? n.mensagem_curta ?? n.mensagemCurta ?? ""),
        mensagem_detalhada: s(n.MensagemDetalhada ?? n.mensagem_detalhada ?? n.mensagemDetalhada ?? ""),
        tipo: s(n.Tipo ?? n.tipo ?? "") || null,
        enviar_push: normalizeSim(n.EnviarPush ?? n.enviar_push ?? n.enviarPush),
      };

      const { error } = await supabaseAdmin
        .from("notifications")
        .upsert(payload, { onConflict: "source_id" });

      if (error) {
        console.log("[cron] upsert error:", error.message);
      } else {
        upserted++;
      }
    }

    return res.json({ ok: true, rows, upserted, skippedNoId });
  } catch (e: any) {
    console.log("[cron/sync-notifications] error:", e?.message || e);
    return res.status(500).json({ ok: false, error: e?.message || "Erro interno" });
  }
});

export default router;
