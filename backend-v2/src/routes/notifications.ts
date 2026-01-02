// src/routes/notifications.ts
import { Router, Request, Response } from "express";
import { requireAuth } from "./auth";
import { supabaseAdmin } from "../lib/supabase";

const router = Router();

/** helpers */
function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}
function s(v: any) {
  return String(v ?? "").trim();
}
function safeStrOrNull(v: any): string | null {
  const x = s(v);
  return x ? x : null;
}

async function getCodProjetosByParty(party: { cpf_cnpj?: any; omie_code?: any }) {
  const cpfCnpj = s(party.cpf_cnpj);
  const omieCode = s(party.omie_code);

  if (omieCode) {
    const { data, error } = await supabaseAdmin
      .from("omie_mf_movements")
      .select("cod_projeto")
      .eq("cod_cliente", omieCode);

    if (error) throw new Error(error.message);

    return uniq((data ?? []).map((r: any) => s(r?.cod_projeto)).filter(Boolean));
  }

  if (cpfCnpj) {
    const { data } = await supabaseAdmin
      .from("omie_mf_movements")
      .select("cod_projeto")
      .or(`cpf.eq.${cpfCnpj},cpf_cnpj.eq.${cpfCnpj}`);

    return uniq((data ?? []).map((r: any) => s(r?.cod_projeto)).filter(Boolean));
  }

  return [];
}

async function getProjectNamesByCodProjetos(codProjetos: string[]) {
  if (!codProjetos.length) return [];

  const { data, error } = await supabaseAdmin
    .from("omie_projects")
    .select("name")
    .in("omie_internal_code", codProjetos);

  if (error) throw new Error(error.message);

  return uniq((data ?? []).map((p: any) => s(p?.name)).filter(Boolean));
}

async function fetchNotificationsForParty(party: any) {
  const codProjetos = await getCodProjetosByParty(party);
  const projectNames = await getProjectNamesByCodProjetos(codProjetos);

  let query = supabaseAdmin
    .from("notifications")
    .select("*")
    .order("datahora", { ascending: false })
    .limit(200);

  if (projectNames.length > 0) {
    const inList = projectNames.map((n) => `"${n}"`).join(",");
    query = query.or(`codigo_imovel.is.null,codigo_imovel.in.(${inList})`);
  } else {
    query = query.is("codigo_imovel", null);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return data ?? [];
}

/**
 * GET /notifications
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const partyId = s((req as any).user?.party_id);

    const { data: party } = await supabaseAdmin
      .from("omie_parties")
      .select("id, name, cpf_cnpj, omie_code")
      .eq("id", partyId)
      .maybeSingle();

    if (!party) return res.status(404).json({ ok: false });

    const notifications = await fetchNotificationsForParty(party);

    res.json({ ok: true, notifications });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * GET /notifications/unread-count
 */
router.get("/unread-count", requireAuth, async (req, res) => {
  try {
    const partyId = s((req as any).user?.party_id);

    const { data: party } = await supabaseAdmin
      .from("omie_parties")
      .select("id, cpf_cnpj, omie_code")
      .eq("id", partyId)
      .maybeSingle();

    if (!party) return res.json({ ok: true, unread: 0 });

    const notifications = await fetchNotificationsForParty(party);
    const ids = notifications.map((n: any) => n.id);

    const { data: reads } = await supabaseAdmin
      .from("notification_reads")
      .select("notification_id")
      .eq("party_id", partyId)
      .in("notification_id", ids);

    const readSet = new Set((reads ?? []).map((r: any) => r.notification_id));
    const unread = ids.filter((id: number) => !readSet.has(id)).length;

    res.json({ ok: true, unread });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * POST /notifications/mark-read
 */
router.post("/mark-read", requireAuth, async (req, res) => {
  try {
    const partyId = s((req as any).user?.party_id);

    const { data: party } = await supabaseAdmin
      .from("omie_parties")
      .select("id, cpf_cnpj, omie_code")
      .eq("id", partyId)
      .maybeSingle();

    if (!party) return res.json({ ok: true, marked: 0 });

    const notifications = await fetchNotificationsForParty(party);
    const ids = notifications.map((n: any) => n.id);

    const rows = ids.map((id) => ({
      party_id: partyId,
      notification_id: id,
      read_at: new Date().toISOString(),
    }));

    await supabaseAdmin
      .from("notification_reads")
      .upsert(rows, { onConflict: "party_id,notification_id" });

    res.json({ ok: true, marked: ids.length });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
