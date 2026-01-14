import { Router } from "express";
import { Expo } from "expo-server-sdk";
import { supabaseAdmin } from "../lib/supabase";

const router = Router();
const expo = new Expo();

/* =========================
   Admin auth (x-admin-key)
========================= */
function requireAdmin(req: any, res: any, next: any) {
  const got = String(req.headers["x-admin-key"] || "");
  const expected = String(process.env.ADMIN_API_KEY || "");
  if (!expected) return res.status(500).json({ ok: false, error: "ADMIN_API_KEY não configurado" });
  if (!got || got !== expected) return res.status(401).json({ ok: false, error: "Unauthorized" });
  return next();
}

/* =========================
   Helpers (copiados do notifications.ts)
========================= */
function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}
function s(v: any) {
  return String(v ?? "").trim();
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

/**
 * Para um party, retorna os nomes de projetos (operations.name) que ele participa
 */
async function getAllowedProjectNamesForParty(party: any) {
  const codProjetos = await getCodProjetosByParty(party);
  const projectNames = await getProjectNamesByCodProjetos(codProjetos);
  return projectNames;
}

/* =========================
   POST /push/dispatch
   - Busca notificações pendentes (enviar_push=true, push_sent_at null)
   - Para cada notificação:
       - se codigo_imovel null: push global => todos tokens
       - se codigo_imovel preenchido: só quem tem esse projeto (igual notifications.ts)
========================= */
router.post("/dispatch", requireAdmin, async (_req, res) => {
  try {
    // 1) notificações pendentes
    const { data: notifs, error: nErr } = await supabaseAdmin
      .from("notifications")
      .select("*")
      .eq("enviar_push", true)
      .is("push_sent_at", null)
      .order("datahora", { ascending: true })
      .limit(50);

    if (nErr) throw new Error(`notifications: ${nErr.message}`);
    if (!notifs?.length) return res.json({ ok: true, sent: 0, details: "NO_PENDING" });

    // 2) tokens (party_id -> tokens)
    const { data: tokens, error: tErr } = await supabaseAdmin
      .from("push_tokens")
      .select("party_id, expo_push_token");

    if (tErr) throw new Error(`push_tokens: ${tErr.message}`);

    const tokenByPartyId = new Map<string, string[]>();
    for (const t of tokens ?? []) {
      const partyId = s((t as any).party_id);
      const tk = s((t as any).expo_push_token);
      if (!partyId || !Expo.isExpoPushToken(tk)) continue;
      const arr = tokenByPartyId.get(partyId) ?? [];
      arr.push(tk);
      tokenByPartyId.set(partyId, arr);
    }

    if (tokenByPartyId.size === 0) {
      return res.json({ ok: true, sent: 0, details: "NO_VALID_TOKENS" });
    }

    // 3) carregar dados mínimos das parties (uma vez) pra calcular allowed projects
    const partyIds = Array.from(tokenByPartyId.keys());

    const { data: parties, error: pErr } = await supabaseAdmin
      .from("omie_parties")
      .select("id, cpf_cnpj, omie_code")
      .in("id", partyIds);

    if (pErr) throw new Error(`omie_parties: ${pErr.message}`);

    const partyById = new Map<string, any>();
    for (const p of parties ?? []) partyById.set(s((p as any).id), p);

    // 4) cache allowed projects por party_id
    const allowedProjectsByPartyId = new Map<string, Set<string>>();
    let partiesComputed = 0;

    async function ensureAllowedProjects(partyId: string) {
      if (allowedProjectsByPartyId.has(partyId)) return;
      const party = partyById.get(partyId);
      if (!party) {
        allowedProjectsByPartyId.set(partyId, new Set()); // sem party = sem projetos
        return;
      }
      const names = await getAllowedProjectNamesForParty(party);
      allowedProjectsByPartyId.set(partyId, new Set(names));
      partiesComputed++;
    }

    // 5) montar mensagens segmentadas
    const messages: any[] = [];
    let skippedNoMapping = 0;

    for (const n of notifs) {
      const codigoImovel = s((n as any).codigo_imovel);

      // Global: manda pra todos
      if (!codigoImovel) {
        for (const [pid, arr] of tokenByPartyId.entries()) {
          for (const tk of arr) {
            messages.push({
              to: tk,
              sound: "default",
              title: (n as any).mensagem_curta ?? "Triade",
              body: (n as any).mensagem_detalhada ?? (n as any).mensagem_curta ?? "",
              data: {
                notification_id: (n as any).id,
                codigo_imovel: (n as any).codigo_imovel ?? null,
                tipo: (n as any).tipo ?? null,
              },
            });
          }
        }
        continue;
      }

      // Segmentado: só quem tem esse projeto
      let anyTarget = false;

      for (const pid of partyIds) {
        await ensureAllowedProjects(pid);
        const allowed = allowedProjectsByPartyId.get(pid) ?? new Set<string>();

        if (!allowed.has(codigoImovel)) continue;

        anyTarget = true;
        const arr = tokenByPartyId.get(pid) ?? [];
        for (const tk of arr) {
          messages.push({
            to: tk,
            sound: "default",
            title: (n as any).mensagem_curta ?? "Triade",
            body: (n as any).mensagem_detalhada ?? (n as any).mensagem_curta ?? "",
            data: {
              notification_id: (n as any).id,
              codigo_imovel: (n as any).codigo_imovel ?? null,
              tipo: (n as any).tipo ?? null,
            },
          });
        }
      }

      if (!anyTarget) skippedNoMapping++;
    }

    if (!messages.length) {
      return res.json({
        ok: true,
        sent: 0,
        details: "NO_TARGETS",
        pending: notifs.length,
        partiesWithTokens: tokenByPartyId.size,
        partiesComputed,
        skippedNoMapping,
      });
    }

    // 6) enviar para Expo (em chunks)
    const chunks = expo.chunkPushNotifications(messages);
    const tickets: any[] = [];

    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }

    // 7) marcar notificações como enviadas
    const sentAt = new Date().toISOString();
    const notifIds = notifs.map((x: any) => x.id);

    const { error: uErr } = await supabaseAdmin
      .from("notifications")
      .update({ push_sent_at: sentAt })
      .in("id", notifIds);

    if (uErr) throw new Error(`update notifications: ${uErr.message}`);

    return res.json({
      ok: true,
      pending: notifs.length,
      partiesWithTokens: tokenByPartyId.size,
      partiesComputed,
      skippedNoMapping,
      messages: messages.length,
      updated: notifIds.length,
      ticketsSample: tickets.slice(0, 5),
    });
  } catch (err: any) {
    console.log("[push/dispatch] error:", err?.message || err);
    return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});

export default router;
