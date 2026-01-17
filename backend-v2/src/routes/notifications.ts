// src/routes/notifications.ts
import { Router } from "express";
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

/**
 * GET /notifications
 * - Admin: retorna TODAS as notificações
 * - Usuário normal: filtra por projetos
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;

    // ✅ ADMIN: tudo
    if (user?.is_admin) {
      const { data, error } = await supabaseAdmin
        .from("notifications")
        .select("*")
        .order("datahora", { ascending: false })
        .limit(500);

      if (error) throw error;

      return res.json({ ok: true, notifications: data ?? [] });
    }

    // -------------------------
    // USUÁRIO NORMAL
    // -------------------------
    const partyId = s(user?.party_id);

    const { data: party } = await supabaseAdmin
      .from("omie_parties")
      .select("id, cpf_cnpj, omie_code")
      .eq("id", partyId)
      .maybeSingle();

    if (!party) return res.status(404).json({ ok: false });

    // 1) projetos do cliente
    let codProjetos: string[] = [];

    if (party.omie_code) {
      const { data } = await supabaseAdmin
        .from("omie_mf_movements")
        .select("cod_projeto")
        .eq("cod_cliente", party.omie_code);

      codProjetos = uniq((data ?? []).map((r: any) => s(r.cod_projeto)).filter(Boolean));
    }

    // 2) nomes dos projetos
    let projectNames: string[] = [];
    if (codProjetos.length) {
      const { data } = await supabaseAdmin
        .from("omie_projects")
        .select("name")
        .in("omie_internal_code", codProjetos);

      projectNames = uniq((data ?? []).map((p: any) => s(p.name)).filter(Boolean));
    }

    // 3) buscar notificações
    let query = supabaseAdmin
      .from("notifications")
      .select("*")
      .order("datahora", { ascending: false })
      .limit(200);

    if (projectNames.length) {
      const inList = projectNames.map((n) => `"${n}"`).join(",");
      query = query.or(`codigo_imovel.is.null,codigo_imovel.in.(${inList})`);
    } else {
      query = query.is("codigo_imovel", null);
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.json({ ok: true, notifications: data ?? [] });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * GET /notifications/unread-count
 */
router.get("/unread-count", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;

    // ✅ ADMIN: tudo como lido (ou 0)
    if (user?.is_admin) {
      return res.json({ ok: true, unread: 0 });
    }

    const partyId = s(user?.party_id);

    const { data: party } = await supabaseAdmin
      .from("omie_parties")
      .select("id, cpf_cnpj, omie_code")
      .eq("id", partyId)
      .maybeSingle();

    if (!party) return res.json({ ok: true, unread: 0 });

    const { data: notifications } = await supabaseAdmin
      .from("notifications")
      .select("id");

    const ids = (notifications ?? []).map((n: any) => n.id);

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
    const user = (req as any).user;

    // ✅ ADMIN: nada para marcar
    if (user?.is_admin) {
      return res.json({ ok: true, marked: 0 });
    }

    const partyId = s(user?.party_id);

    const { data: notifications } = await supabaseAdmin
      .from("notifications")
      .select("id");

    const ids = (notifications ?? []).map((n: any) => n.id);

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
