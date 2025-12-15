// mobile/app/notifications.tsx
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL } from "../lib/config";
import { getLastLoginCpf } from "../lib/session";
import TriadeLoading from "../components/TriadeLoading";

const MAIN_BLUE = "#0E2A47";

type NotificationItem = {
  id: string;
  dateTimeRaw: string | null;
  codigoImovel: string;
  title: string;
  shortMessage: string;
  detailedMessage?: string | null;
  type?: string | null;
};

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setErrorMsg(null);

        const cpf = getLastLoginCpf(); // vem do login (setLastLoginCpf)
        if (!cpf) {
          setNotifications([]);
          setErrorMsg("CPF não encontrado no app. Faça login novamente.");
          return;
        }

        const notifUrl = `${API_BASE_URL}/notifications?cpf=${encodeURIComponent(
          cpf
        )}`;

        console.log("➡️ [NOTIF PAGE] Buscando notificações em:", notifUrl);

        const notifRes = await fetch(notifUrl);

        if (!notifRes.ok) {
          console.log("⚠️ [NOTIF PAGE] HTTP:", notifRes.status);
          setNotifications([]);
          setErrorMsg("Não foi possível carregar notificações.");
          return;
        }

        const notifData = (await notifRes.json()) as NotificationItem[];
        console.log("✅ [NOTIF PAGE] Notificações recebidas:", notifData?.length);

        setNotifications(notifData ?? []);
      } catch (err) {
        console.log("💥 [NOTIF PAGE] Erro ao carregar notificações:", err);
        setNotifications([]);
        setErrorMsg("Erro ao carregar notificações.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return <TriadeLoading />;
  }

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>

      <ScrollView contentContainerStyle={styles.content}>
        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

        {notifications.length === 0 ? (
          <Text style={styles.emptyText}>
            Nenhuma notificação encontrada para seus imóveis.
          </Text>
        ) : (
          notifications.map((notif) => (
            <View key={notif.id} style={styles.notificationCard}>
              <Text style={styles.notificationSubtitle}>
                {notif.codigoImovel}
                {notif.dateTimeRaw ? ` • ${notif.dateTimeRaw}` : ""}
              </Text>

              <Text style={styles.notificationTitle}>{notif.title}</Text>
              <Text style={styles.notificationShort}>{notif.shortMessage}</Text>

              {notif.detailedMessage ? (
                <Text style={styles.notificationDetails}>
                  {notif.detailedMessage}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MAIN_BLUE },
  content: { padding: 16, paddingBottom: 24 },

  emptyText: { color: "#C3C9D6", fontSize: 13 },
  errorText: { color: "#FFB4B4", fontSize: 13, marginBottom: 10 },

  notificationCard: {
    backgroundColor: "#14395E",
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  notificationSubtitle: {
    color: "#C3C9D6",
    fontSize: 11,
    marginBottom: 6,
  },
  notificationTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
  },
  notificationShort: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  notificationDetails: {
    color: "#E2E6F0",
    fontSize: 12,
    lineHeight: 18,
  },
});
