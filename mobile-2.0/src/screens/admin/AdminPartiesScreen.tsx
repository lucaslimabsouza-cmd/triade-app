// src/screens/admin/AdminPartiesScreen.tsx
// ✅ Lista todos os clientes com dados financeiros

import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AdminStackParamList } from "../../navigation/types";
import Screen from "../Screen";
import TriadeLoading from "../../ui/TriadeLoading";
import { api } from "../../services/api";

type Party = {
  id: string;
  name: string;
  cpf_cnpj?: string;
  omie_code?: string;
  email?: string;
  valorInvestido: number;
  lucroDistribuido: number;
};

type Props = NativeStackScreenProps<AdminStackParamList, "AdminParties">;

function formatCurrency(value: number): string {
  const v = Number.isFinite(value) ? value : 0;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function AdminPartiesScreen({ navigation }: Props) {
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadParties = useCallback(async (force = false) => {
    try {
      if (!force) {
        setLoading(true);
      }
      setErrorMsg(null);

      const res = await api.get("/admin/parties/with-financial", { timeout: 30000 });
      const data = res.data?.parties ?? [];
      setParties(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.log("❌ [AdminParties] error:", err?.message);
      setErrorMsg("Não foi possível carregar os clientes.");
      setParties([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadParties();
  }, [loadParties]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadParties(true);
    } finally {
      setRefreshing(false);
    }
  }, [loadParties]);

  if (loading && parties.length === 0) {
    return (
      <Screen title="Todos os Clientes" scroll={false}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <TriadeLoading />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      title="Todos os Clientes"
      refreshing={refreshing}
      onRefresh={onRefresh}
      scroll={false}
    >
      <View style={styles.container}>
        {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

        {parties.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nenhum cliente encontrado.</Text>
          </View>
        ) : (
          <FlatList
            data={parties}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <View style={styles.partyCard}>
                <Text style={styles.partyName}>{item.name || "Sem nome"}</Text>
                
                {item.cpf_cnpj && (
                  <Text style={styles.partyInfo}>CPF/CNPJ: {item.cpf_cnpj}</Text>
                )}

                <View style={styles.financialRow}>
                  <View style={styles.financialColumn}>
                    <Text style={styles.financialLabel}>Valor investido atual</Text>
                    <Text style={styles.financialValue}>{formatCurrency(item.valorInvestido)}</Text>
                  </View>

                  <View style={styles.financialColumn}>
                    <Text style={styles.financialLabel}>Lucro já distribuído</Text>
                    <Text style={styles.financialValue}>{formatCurrency(item.lucroDistribuido)}</Text>
                  </View>
                </View>
              </View>
            )}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />
            }
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    </Screen>
  );
}

export default AdminPartiesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorText: {
    color: "#FFB4B4",
    fontSize: 13,
    marginBottom: 12,
    padding: 12,
    backgroundColor: "#14395E",
    borderRadius: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    color: "#C3C9D6",
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 20,
  },
  partyCard: {
    backgroundColor: "#14395E",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  partyName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  partyInfo: {
    fontSize: 12,
    color: "#C3C9D6",
    marginBottom: 12,
  },
  financialRow: {
    flexDirection: "row",
    marginTop: 8,
    gap: 16,
  },
  financialColumn: {
    flex: 1,
  },
  financialLabel: {
    fontSize: 11,
    color: "#C3C9D6",
    marginBottom: 4,
  },
  financialValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
