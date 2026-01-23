// src/screens/admin/AdminMovementsScreen.tsx
// ✅ Lista todas as movimentações sem filtro

import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AdminStackParamList } from "../../navigation/types";
import Screen from "../Screen";
import TriadeLoading from "../../ui/TriadeLoading";
import { api } from "../../services/api";

type Movement = {
  cod_mov_cc?: string;
  descricao?: string;
  valor?: number;
  dt_pagamento?: string;
  dt_emissao?: string;
  cod_cliente?: string;
};

type Props = NativeStackScreenProps<AdminStackParamList, "AdminMovements">;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR");
  } catch {
    return dateStr;
  }
}

export function AdminMovementsScreen({ navigation }: Props) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMovements = useCallback(async (force = false) => {
    try {
      if (!force) {
        setLoading(true);
      }

      const res = await api.get("/admin/movements/all?limit=500", { timeout: 30000 });
      const data = res.data?.movements ?? [];
      setMovements(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.log("❌ [AdminMovements] error:", err?.message);
      setMovements([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadMovements(true);
    } finally {
      setRefreshing(false);
    }
  }, [loadMovements]);

  if (loading && movements.length === 0) {
    return (
      <Screen title="Movimentações" scroll={false}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <TriadeLoading />
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Movimentações" refreshing={refreshing} onRefresh={onRefresh} scroll={false}>
      <View style={styles.container}>
        <FlatList
          data={movements}
          keyExtractor={(item, idx) => String(item.cod_mov_cc || idx)}
          renderItem={({ item }) => (
            <View style={styles.movementCard}>
              <Text style={styles.movementDesc}>{item.descricao || "Sem descrição"}</Text>
              <View style={styles.movementRow}>
                <Text style={styles.movementValue}>{formatCurrency(item.valor || 0)}</Text>
                <Text style={styles.movementDate}>
                  {formatDate(item.dt_pagamento || item.dt_emissao)}
                </Text>
              </View>
              {item.cod_cliente && (
                <Text style={styles.movementClient}>Cliente: {item.cod_cliente}</Text>
              )}
            </View>
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />
          }
          contentContainerStyle={styles.listContent}
        />
      </View>
    </Screen>
  );
}

export default AdminMovementsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  movementCard: {
    backgroundColor: "#14395E",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  movementDesc: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  movementRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  movementValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#8AB4FF",
  },
  movementDate: {
    fontSize: 12,
    color: "#C3C9D6",
  },
  movementClient: {
    fontSize: 11,
    color: "#9CAFC5",
    marginTop: 4,
  },
});
