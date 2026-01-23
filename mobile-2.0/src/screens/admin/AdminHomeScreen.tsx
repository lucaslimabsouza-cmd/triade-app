// src/screens/admin/AdminHomeScreen.tsx
// ✅ Tela inicial do admin - mostra visão geral sem filtros

import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AdminStackParamList } from "../../navigation/types";
import Screen from "../Screen";
import TriadeLoading from "../../ui/TriadeLoading";
import { api } from "../../services/api";

const MAIN_BLUE = "#0E2A47";

type Props = NativeStackScreenProps<AdminStackParamList, "AdminHome"> & {
  onLogout?: () => Promise<void>;
};

function formatCurrency(value: number): string {
  const v = Number.isFinite(value) ? value : 0;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function AdminHomeScreen({ navigation, onLogout }: Props) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    operacoesEmAndamento: 0,
    operacoesFinalizadas: 0,
    clientesAtivos: 0,
    valorTotalInvestido: 0,
    lucroTotalDistribuido: 0,
  });

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);

      const res = await api.get("/admin/stats", { timeout: 30000 });
      const statsData = res.data?.stats ?? {};

      setStats({
        operacoesEmAndamento: statsData.operacoesEmAndamento ?? 0,
        operacoesFinalizadas: statsData.operacoesFinalizadas ?? 0,
        clientesAtivos: statsData.clientesAtivos ?? 0,
        valorTotalInvestido: statsData.valorTotalInvestido ?? 0,
        lucroTotalDistribuido: statsData.lucroTotalDistribuido ?? 0,
      });
    } catch (err) {
      console.log("❌ [AdminHome] error loading stats:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading) {
    return (
      <Screen title="Admin" onLogout={onLogout}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <TriadeLoading />
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Admin - Dashboard" onLogout={onLogout} refreshing={false} onRefresh={loadStats}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.welcomeText}>Painel Administrativo</Text>
          <Text style={styles.subtitle}>Visão geral do sistema</Text>
        </View>

        {/* Estatísticas - Primeira linha (3 cards) */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.operacoesEmAndamento}</Text>
            <Text style={styles.statLabel}>Operações em andamento</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.operacoesFinalizadas}</Text>
            <Text style={styles.statLabel}>Operações finalizadas</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.clientesAtivos}</Text>
            <Text style={styles.statLabel}>Clientes ativos</Text>
          </View>
        </View>

        {/* Estatísticas - Segunda linha (2 cards centralizados) */}
        <View style={styles.statsRowCentered}>
          <View style={[styles.statCard, styles.statCardWide]}>
            <Text style={styles.statValue}>{formatCurrency(stats.valorTotalInvestido)}</Text>
            <Text style={styles.statLabel}>Valor total investido</Text>
          </View>
          <View style={[styles.statCard, styles.statCardWide]}>
            <Text style={styles.statValue}>{formatCurrency(stats.lucroTotalDistribuido)}</Text>
            <Text style={styles.statLabel}>Lucro total distribuído</Text>
          </View>
        </View>

        {/* Ações rápidas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ações Rápidas</Text>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate("AdminOperations")}
            activeOpacity={0.85}
          >
            <Text style={styles.actionTitle}>Ver Todas as Operações</Text>
            <Text style={styles.actionSubtitle}>Sem filtros - todas as operações do sistema</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate("AdminParties")}
            activeOpacity={0.85}
          >
            <Text style={styles.actionTitle}>Ver Todos os Clientes</Text>
            <Text style={styles.actionSubtitle}>Lista completa de clientes cadastrados</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Screen>
  );
}

export default AdminHomeScreen;

const styles = StyleSheet.create({
  header: {
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#C3C9D6",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  statsRowCentered: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    justifyContent: "center",
  },
  statCard: {
    flex: 1,
    backgroundColor: "#14395E",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  statCardWide: {
    flex: 1,
    maxWidth: "48%",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 4,
    textAlign: "center",
  },
  statLabel: {
    fontSize: 11,
    color: "#C3C9D6",
    textAlign: "center",
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  actionCard: {
    backgroundColor: "#14395E",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 13,
    color: "#C3C9D6",
  },
});
