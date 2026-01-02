import { Router } from "express";
import { Expo } from "expo-server-sdk";
import { supabaseAdmin } from "../lib/supabase";

const router = Router();
const expo = new Expo();

router.post("/dispatch", async (_req, res) => {
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

    // 2) tokens (MVP: manda pra todos tokens; depois a gente filtra por codigo_imovel)
    const { data: tokens, error: tErr } = await supabaseAdmin
      .from("push_tokens")
      .select("party_id, expo_push_token");

    if (tErr) throw new Error(`push_tokens: ${tErr.message}`);
    const expoTokens = (tokens ?? [])
      .map((t: any) => t.expo_push_token)
      .filter((tk: string) => Expo.isExpoPushToken(tk));

    if (expoTokens.length === 0) {
      return res.json({ ok: true, sent: 0, details: "NO_VALID_TOKENS" });
    }

    // 3) monta mensagens (MVP: envia cada notificação para todos tokens)
    const messages: any[] = [];
    for (const n of notifs) {
      for (const tk of expoTokens) {
        messages.push({
          to: tk,
          sound: "default",
          title: n.mensagem_curta ?? "Triade",
          body: n.mensagem_detalhada ?? n.mensagem_curta ?? "",
          data: {
            notification_id: n.id,
            codigo_imovel: n.codigo_imovel ?? null,
            tipo: n.tipo ?? null,
          },
        });
      }
    }

    const chunks = expo.chunkPushNotifications(messages);
    const tickets: any[] = [];

    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }

    // 4) marca como enviado (MVP: marca todas as notificações como enviadas agora)
    const sentAt = new Date().toISOString();
    const notifIds = notifs.map((n: any) => n.id);

    const { error: uErr } = await supabaseAdmin
      .from("notifications")
      .update({ push_sent_at: sentAt })
      .in("id", notifIds);

    if (uErr) throw new Error(`update notifications: ${uErr.message}`);

    return res.json({
      ok: true,
      pending: notifs.length,
      tokens: expoTokens.length,
      messages: messages.length,
      updated: notifIds.length,
      ticketsSample: tickets.slice(0, 5),
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});

export default router;
