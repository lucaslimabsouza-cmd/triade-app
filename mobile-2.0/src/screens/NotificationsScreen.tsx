// src/screens/NotificationsScreen.tsx
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

import TriadeLoading from "../ui/TriadeLoading";
import { api } from "../services/api";

const MAIN_BLUE = "#0E2A47";

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

// Ordena notificações por datahora (mais recente primeiro)
function sortNotificationsByDate(notifications: NotificationItem[]): NotificationItem[] {
  return [...notifications].sort((a, b) => {
    const dateA = a.datahora ? new Date(a.datahora).getTime() : 0;
    const dateB = b.datahora ? new Date(b.datahora).getTime() : 0;
    return dateB - dateA; // Ordem decrescente (mais recente primeiro)
  });
}

export function NotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const res = await api.get("/notifications", { timeout: 30000 });
      const payload = res.data ?? {};
      const list = Array.isArray(payload?.notifications) ? payload.notifications : [];
      const sortedList = sortNotificationsByDate(list);
      setNotifications(sortedList);

      // ✅ Considera como "lido" quando a pessoa VISITA a página
      // (se a rota existir no backend)
      try {
        await api.post("/notifications/mark-read", { mode: "all" }, { timeout: 20000 });
      } catch {
        // silencioso (não quebra a tela se ainda não estiver ok)
      }
    } catch (err: any) {
      setNotifications([]);
      setErrorMsg("Não foi possível carregar notificações.");
    } finally {
      setLoading(false);
    }
  }, []);

  // carrega 1x
  useEffect(() => {
    load();
  }, [load]);

  // e também recarrega quando entrar na tela (caso chegue push/novas)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.loadingWrap}>
          <TriadeLoading />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* ✅ título dentro da tela (sem header) */}
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
      </ScrollView>
    </SafeAreaView>
  );
}

export default NotificationsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MAIN_BLUE },
  content: { padding: 16, paddingBottom: 24 },

  // loading centralizado de verdade
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center" },

  pageTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12,
  },

  emptyText: { color: "#C3C9D6", fontSize: 13 },
  errorText: { color: "#FFB4B4", fontSize: 13, marginBottom: 10 },

  card: {
    backgroundColor: "#14395E",
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  meta: { color: "#C3C9D6", fontSize: 11, marginBottom: 6 },
  short: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", marginBottom: 4 },
  details: { color: "#E2E6F0", fontSize: 12, lineHeight: 18 },
});
