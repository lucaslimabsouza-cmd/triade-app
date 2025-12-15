// mobile/app/home.tsx
import { useAuth } from "../lib/auth";

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { API_BASE_URL } from "../lib/config";

import TriadeLoading from "../components/TriadeLoading";
import { getLastLoginCpf } from "../lib/session";

const MAIN_BLUE = "#0E2A47";

type Operation = {
  id: string | number;
  status?: string; // "em_andamento" | "concluida"
  amountInvested?: number;
  totalInvestment?: number;
  realizedProfit?: number;
  netProfit?: number;
  roi?: number;
};

type NotificationItem = {
  id: string;
  dateTimeRaw: string | null;
  codigoImovel: string;
  title: string;
  shortMessage: string;
  detailedMessage?: string | null;
  type?: string | null;
};

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(true);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        if (!alive) return;
        setLoading(true);

        const url = `${API_BASE_URL}/operations`;
        console.log("➡️ [HOME] Buscando operações para dashboard em:", url);

        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = (await res.json()) as Operation[];
        console.log("✅ [HOME] Operações recebidas:", JSON.stringify(data));

        if (!alive) return;
        setOperations(data ?? []);
      } catch (e) {
        console.log("Erro geral ao carregar Home:", e);
        if (!alive) return;
        setOperations([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  // 🔔 Carrega notificações (somente as mais recentes)
  useEffect(() => {
    let alive = true;

    async function loadNotifs() {
      try {
        if (!alive) return;
        setLoadingNotifs(true);

        const cpf = getLastLoginCpf();
        if (!cpf) {
          if (!alive) return;
          setNotifications([]);
          return;
        }

        const notifUrl = `${API_BASE_URL}/notifications?cpf=${encodeURIComponent(
          cpf
        )}`;
        console.log("➡️ [HOME] Buscando notificações em:", notifUrl);

        const res = await fetch(notifUrl);
        if (!res.ok) {
          console.log("⚠️ [HOME] Notifs HTTP:", res.status);
          if (!alive) return;
          setNotifications([]);
          return;
        }

        const data = (await res.json()) as NotificationItem[];
        if (!alive) return;
        setNotifications(data ?? []);
      } catch (e) {
        console.log("💥 [HOME] Erro ao carregar notificações:", e);
        if (!alive) return;
        setNotifications([]);
      } finally {
        if (!alive) return;
        setLoadingNotifs(false);
      }
    }

    loadNotifs();
    return () => {
      alive = false;
    };
  }, []);

  const firstName = user?.name?.split(" ")[0] || "investidor";

  function goToOperations() {
    router.push("/operations");
  }

  function goToNotifications() {
    router.push("/notifications");
  }

  // ✅ Loading padronizado
  if (loading) {
    return <TriadeLoading />;
  }

  const totalOperations = operations.length;
  const activeOperations = operations.filter(
    (op) => op.status === "em_andamento"
  ).length;
  const finishedOperations = totalOperations - activeOperations;

  const summary = getSummaryFromOperations(operations);

  // pega só a última notificação (se quiser 3, troca para slice(0, 3))
  const latestNotifs = (notifications ?? []).slice(0, 1);

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>

      <ScrollView
        contentContainerStyle={styles.content}
        scrollIndicatorInsets={{ top: 0, bottom: 24 }}
      >
        {/* Cabeçalho */}
        <View style={styles.header}>
          <Text style={styles.welcomeText}>Olá, {firstName}</Text>
          <Text style={styles.subtitle}>
            Acompanhe a evolução dos seus investimentos.
          </Text>
        </View>

        {/* Total investido */}
        <View style={styles.metricsRow}>
          <MetricCard
            label="Total dos investimentos"
            value={formatCurrency(summary.totalInvested)}
          />
        </View>

        {/* Minhas operações */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumo das operações</Text>

          <TouchableOpacity
            style={styles.operationsCard}
            onPress={goToOperations}
            activeOpacity={0.8}
          >
            <Text style={styles.operationsTitle}>
              Você possui {totalOperations} operação
              {totalOperations !== 1 ? "es" : ""}
            </Text>

            <Text style={styles.operationsSubtitle}>
              {activeOperations} em andamento • {finishedOperations} concluída
              {finishedOperations !== 1 ? "s" : ""}
            </Text>

            <Text style={styles.operationsLinkText}>
              Ver detalhes das operações →
            </Text>
          </TouchableOpacity>
        </View>

        {/* Lucro + ROI */}
        <View style={styles.section}>
          <View style={styles.metricsRow}>
            <MetricCard
              label="Lucro realizado"
              value={formatCurrency(summary.totalRealizedProfit)}
            />
            <MetricCard
              label="ROI médio realizado"
              value={summary.averageRoi.toFixed(1) + "%"}
            />
          </View>
        </View>

        {/* 🔔 Notificações */}
        <View style={styles.section}>
          <View style={styles.notifHeaderRow}>
            <Text style={styles.sectionTitle}>Últimas notificações</Text>

            <TouchableOpacity onPress={goToNotifications} activeOpacity={0.8}>
              <Text style={styles.notifLink}>Ver todas →</Text>
            </TouchableOpacity>
          </View>

          {loadingNotifs ? (
            <Text style={styles.notifEmpty}>Carregando notificações...</Text>
          ) : latestNotifs.length === 0 ? (
            <Text style={styles.notifEmpty}>Nenhuma notificação recente.</Text>
          ) : (
            latestNotifs.map((n) => (
              <TouchableOpacity
                key={n.id}
                style={styles.notifCard}
                activeOpacity={0.85}
                onPress={goToNotifications}
              >
                <Text style={styles.notifMeta}>
                  {n.codigoImovel}
                  {n.dateTimeRaw ? ` • ${n.dateTimeRaw}` : ""}
                </Text>

                <Text style={styles.notifShort}>{n.shortMessage}</Text>

                <Text style={styles.notifLong}>
                  {n.detailedMessage && n.detailedMessage.trim() !== ""
                    ? n.detailedMessage
                    : "Ainda não disponível."}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---- resumo ----
function getSummaryFromOperations(operations: Operation[]) {
  if (!operations || operations.length === 0) {
    return { totalInvested: 0, totalRealizedProfit: 0, averageRoi: 0 };
  }

  let investedSumAll = 0;
  let realizedSumAll = 0;

  for (const op of operations) {
    investedSumAll += Number(op.amountInvested ?? op.totalInvestment ?? 0);
    realizedSumAll += Number(op.realizedProfit ?? op.netProfit ?? 0);
  }

  const finishedOps = operations.filter((op) => op.status === "concluida");

  let investedFinished = 0;
  let realizedFinished = 0;

  for (const op of finishedOps) {
    investedFinished += Number(op.amountInvested ?? op.totalInvestment ?? 0);
    realizedFinished += Number(op.realizedProfit ?? op.netProfit ?? 0);
  }

  let averageRoi = 0;
  if (investedFinished > 0) {
    averageRoi = (realizedFinished / investedFinished) * 100;
  }

  return {
    totalInvested: investedSumAll,
    totalRealizedProfit: realizedSumAll,
    averageRoi,
  };
}

// ---- componente ----
function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MAIN_BLUE },

  // ⭐ aqui é onde “subimos” a tela sem exagerar
  content: { padding: 16, paddingTop: 8, paddingBottom: 48 },

  // ⭐ tiramos marginTop 16 (era ele que empurrava pra baixo)
  header: { marginTop: 20, marginBottom: 16 },
  welcomeText: { fontSize: 22, fontWeight: "600", color: "#FFFFFF" },
  subtitle: { fontSize: 14, color: "#D0D7E3" },

  metricsRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  metricCard: {
    flex: 1,
    backgroundColor: "#14395E",
    borderRadius: 12,
    padding: 12,
  },
  metricLabel: { color: "#C3C9D6", fontSize: 12 },
  metricValue: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 4,
  },

  section: { marginTop: 20 },
  sectionTitle: {
    fontSize: 18,
    color: "#FFFFFF",
    marginBottom: 8,
    fontWeight: "600",
  },

  operationsCard: {
    backgroundColor: "#14395E",
    borderRadius: 12,
    padding: 16,
  },
  operationsTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  operationsSubtitle: {
    color: "#C5D2E0",
    fontSize: 13,
    marginBottom: 10,
  },
  operationsLinkText: {
    color: "#8AB4FF",
    fontSize: 13,
    fontWeight: "500",
  },

  notifHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  notifLink: {
    color: "#8AB4FF",
    fontSize: 13,
    fontWeight: "600",
  },
  notifEmpty: {
    color: "#C3C9D6",
    fontSize: 13,
  },
  notifCard: {
    backgroundColor: "#14395E",
    borderRadius: 12,
    padding: 12,
  },
  notifMeta: {
    color: "#C3C9D6",
    fontSize: 11,
    marginBottom: 6,
  },
  notifShort: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 6,
  },
  notifLong: {
    color: "#E2E6F0",
    fontSize: 12,
    lineHeight: 18,
  },
});
