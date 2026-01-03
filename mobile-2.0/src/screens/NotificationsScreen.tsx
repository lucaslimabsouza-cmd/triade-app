import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import Screen from "./Screen";
import TriadeLoading from "../ui/TriadeLoading";
import { api } from "../services/api";

import { cacheGet, getOrFetch } from "../cache/memoryCache";
import { CACHE_KEYS } from "../cache/cacheKeys";

import { useScreenRefresh } from "../refresh/useScreenRefresh";

type NotificationItem = {
  id: number;
  datahora?: string | null;
  codigo_imovel?: string | null;
  mensagem_curta?: string | null;
  mensagem_detalhada?: string | null;
  tipo?: string | null;
};

function formatDateBR(iso?: string | null) {
  const s = String(iso ?? "").trim();
  if (!s) return "";
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

export function NotificationsScreen() {
  const key = CACHE_KEYS.NOTIFICATIONS("me-v2");

  // ✅ pega cache SINCRONO no primeiro render (sem flash)
  const cachedFirst = cacheGet<any>(key);
  const initialList: NotificationItem[] =
    Array.isArray(cachedFirst?.notifications) ? cachedFirst.notifications : [];

  const [notifications, setNotifications] = useState<NotificationItem[]>(initialList);
  const [loading, setLoading] = useState(initialList.length === 0); // ✅ só mostra loading se não tem cache
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setErrorMsg(null);

      // ✅ se já tem dados na tela, NÃO precisa ligar loading (deixa o spinner do pull-to-refresh cuidar)
      if (notifications.length === 0) setLoading(true);

      const data = await getOrFetch(key, async () => {
        const res = await api.get("/notifications", { timeout: 30000 });
        return res.data ?? {};
      });

      const list = Array.isArray(data?.notifications) ? data.notifications : [];
      setNotifications(list);

      // ✅ marca como lido ao visitar/atualizar
      try {
        await api.post("/notifications/mark-read", { mode: "all" }, { timeout: 20000 });
      } catch {
        // silencioso
      }
    } catch {
      setNotifications([]);
      setErrorMsg("Não foi possível carregar notificações.");
    } finally {
      setLoading(false);
    }
  }, [key, notifications.length]);

  // ✅ 1 linha: registra pro pull-to-refresh
  useScreenRefresh(loadData);

  // ✅ carrega ao entrar/voltar (e pega cache imediatamente via state)
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  if (loading) {
    return (
      <Screen title="" padding={16} contentTopOffset={0}>
        <View style={styles.loadingWrap}>
          <TriadeLoading />
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="" padding={16} contentTopOffset={0}>
      <Text style={styles.pageTitle}>Notificações</Text>

      {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

      {notifications.length === 0 ? (
        <Text style={styles.emptyText}>Nenhuma notificação encontrada.</Text>
      ) : (
        notifications.map((n) => (
          <View key={String(n.id)} style={styles.card}>
            <Text style={styles.meta}>
              {(n.codigo_imovel ? n.codigo_imovel : "Global") +
                (n.datahora ? ` • ${formatDateBR(n.datahora)}` : "")}
            </Text>

            <Text style={styles.short}>{n.mensagem_curta ?? ""}</Text>

            {n.mensagem_detalhada && String(n.mensagem_detalhada).trim() !== "" ? (
              <Text style={styles.details}>{n.mensagem_detalhada}</Text>
            ) : null}
          </View>
        ))
      )}
    </Screen>
  );
}

export default NotificationsScreen;

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center" },

  pageTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "800", marginBottom: 12 },
  emptyText: { color: "#C3C9D6", fontSize: 13 },
  errorText: { color: "#FFB4B4", fontSize: 13, marginBottom: 10 },

  card: { backgroundColor: "#14395E", padding: 12, borderRadius: 12, marginBottom: 10 },
  meta: { color: "#C3C9D6", fontSize: 11, marginBottom: 6 },
  short: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", marginBottom: 4 },
  details: { color: "#E2E6F0", fontSize: 12, lineHeight: 18 },
});
