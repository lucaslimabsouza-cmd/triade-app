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

  // ✅ Vínculo correto: omie_parties.omie_code -> omie_mf_movements.cod_cliente
  if (omieCode) {
    const { data, error } = await supabaseAdmin
      .from("omie_mf_movements")
      .select("cod_projeto")
      .eq("cod_cliente", omieCode);

    if (error) throw new Error(`omie_mf_movements (cod_cliente): ${error.message}`);

    return uniq((data ?? []).map((r: any) => s(r?.cod_projeto)).filter(Boolean));
  }

  // Fallbacks (se vier sem omie_code)
  if (cpfCnpj) {
    // tenta cpf_cnpj
    {
      const { data, error } = await supabaseAdmin
        .from("omie_mf_movements")
        .select("cod_projeto")
        .eq("cpf_cnpj", cpfCnpj);

      if (!error) {
        const cods = uniq((data ?? []).map((r: any) => s(r?.cod_projeto)).filter(Boolean));
        if (cods.length) return cods;
      } else if (!String(error.message ?? "").toLowerCase().includes("column")) {
        throw new Error(`omie_mf_movements (cpf_cnpj): ${error.message}`);
      }
    }

    // tenta cpf
    {
      const { data, error } = await supabaseAdmin
        .from("omie_mf_movements")
        .select("cod_projeto")
        .eq("cpf", cpfCnpj);

      if (!error) {
        return uniq((data ?? []).map((r: any) => s(r?.cod_projeto)).filter(Boolean));
      } else if (!String(error.message ?? "").toLowerCase().includes("column")) {
        throw new Error(`omie_mf_movements (cpf): ${error.message}`);
      }
    }
  }

  return [];
}

async function getProjectNamesByCodProjetos(codProjetos: string[]) {
  if (!codProjetos.length) return [];

  const { data, error } = await supabaseAdmin
    .from("omie_projects")
    .select("name, omie_internal_code")
    .in("omie_internal_code", codProjetos);

  if (error) throw new Error(`omie_projects: ${error.message}`);

  return uniq((data ?? []).map((p: any) => s(p?.name)).filter(Boolean));
}

/**
 * GET /notifications
 * Retorna notificações globais + por código do imóvel (omie_projects.name)
 * + is_read e unreadCount por party_id
 */
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const partyId = s(user?.party_id);

    if (!partyId) {
      return res.status(401).json({ ok: false, error: "NO_PARTY_ID_IN_TOKEN" });
    }

    // 1) party_id -> omie_parties
    const { data: party, error: partyErr } = await supabaseAdmin
      .from("omie_parties")
      .select("id, name, cpf_cnpj, omie_code")
      .eq("id", partyId)
      .maybeSingle();

    if (partyErr) {
      return res.status(500).json({ ok: false, error: "DB_ERROR", details: partyErr.message });
    }
    if (!party) {
      return res.status(404).json({ ok: false, error: "PARTY_NOT_FOUND" });
    }

    // 2) descobrir cod_projeto onde esse party investe
    const codProjetos = await getCodProjetosByParty(party);

    // 3) cod_projeto -> project names (omie_projects.name)
    const projectNames = await getProjectNamesByCodProjetos(codProjetos);

    // 4) buscar notifications: globais + específicas
    let notifQuery = supabaseAdmin
      .from("notifications")
      .select("id, source_id, datahora, codigo_imovel, mensagem_curta, mensagem_detalhada, tipo, enviar_push, push_sent_at, created_at")
      .order("datahora", { ascending: false })
      .limit(200);

    if (projectNames.length > 0) {
      const inList = projectNames.map((n) => `"${n.replace(/"/g, '\\"')}"`).join(",");
      // globais: null OR ""  (cobrindo os dois)
      notifQuery = notifQuery.or(`codigo_imovel.is.null,codigo_imovel.eq.,codigo_imovel.in.(${inList})`);
    } else {
      notifQuery = notifQuery.or("codigo_imovel.is.null,codigo_imovel.eq.");
    }

    const { data: notificationsRaw, error: nErr } = await notifQuery;
    if (nErr) {
      return res.status(500).json({ ok: false, error: "DB_ERROR", details: nErr.message });
    }

    const ids = (notificationsRaw ?? []).map((n: any) => Number(n.id)).filter(Number.isFinite);

    // 5) leituras do usuário (notification_reads)
    let readSet = new Set<number>();
    if (ids.length > 0) {
      const { data: reads, error: rErr } = await supabaseAdmin
        .from("notification_reads")
        .select("notification_id")
        .eq("party_id", partyId)
        .in("notification_id", ids);

      if (rErr) {
        return res.status(500).json({ ok: false, error: "DB_ERROR", details: rErr.message });
      }

      readSet = new Set((reads ?? []).map((r: any) => Number(r.notification_id)));
    }

    const notifications = (notificationsRaw ?? []).map((n: any) => {
      const idNum = Number(n.id);
      return {
        ...n,
        is_read: readSet.has(idNum),
      };
    });

    const unreadCount = notifications.reduce((acc: number, n: any) => acc + (n.is_read ? 0 : 1), 0);

    return res.json({
      ok: true,
      party: {
        id: party.id,
        name: s(party.name),
        cpf_cnpj: safeStrOrNull(party.cpf_cnpj),
        omie_code: safeStrOrNull(party.omie_code),
      },
      codProjetos,
      projectNames,
      unreadCount,
      total: notifications.length,
      notifications,
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_ERROR",
      details: err?.message ?? String(err),
    });
  }
});

/**
 * POST /notifications/:id/read
 * Marca uma notificação como lida para o usuário logado
 */
router.post("/:id/read", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const partyId = s(user?.party_id);
    const notifId = Number(req.params.id);

    if (!partyId) return res.status(401).json({ ok: false, error: "NO_PARTY_ID_IN_TOKEN" });
    if (!Number.isFinite(notifId)) return res.status(400).json({ ok: false, error: "INVALID_NOTIFICATION_ID" });

    const { error } = await supabaseAdmin
      .from("notification_reads")
      .upsert(
        { notification_id: notifId, party_id: partyId, read_at: new Date().toISOString() },
        { onConflict: "notification_id,party_id" }
      );

    if (error) {
      return res.status(500).json({ ok: false, error: "DB_ERROR", details: error.message });
    }

    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR", details: err?.message ?? String(err) });
  }
});

/**
 * POST /notifications/read-all
 * body: { ids: number[] }
 */
router.post("/read-all", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const partyId = s(user?.party_id);
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isFinite) : [];

    if (!partyId) return res.status(401).json({ ok: false, error: "NO_PARTY_ID_IN_TOKEN" });
    if (ids.length === 0) return res.json({ ok: true, marked: 0 });

    const payload = ids.map((id) => ({
      notification_id: id,
      party_id: partyId,
      read_at: new Date().toISOString(),
    }));

    const { error } = await supabaseAdmin
      .from("notification_reads")
      .upsert(payload, { onConflict: "notification_id,party_id" });

    if (error) {
      return res.status(500).json({ ok: false, error: "DB_ERROR", details: error.message });
    }

    return res.json({ ok: true, marked: ids.length });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR", details: err?.message ?? String(err) });
  }
});

export default router;
