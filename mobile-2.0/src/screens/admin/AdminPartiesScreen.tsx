// src/screens/admin/AdminPartiesScreen.tsx
// ✅ Lista todos os clientes com dados financeiros

import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Modal, ScrollView } from "react-native";
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
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [operations, setOperations] = useState<string[]>([]);
  const [loadingOperations, setLoadingOperations] = useState(false);

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

  const loadOperationsForParty = useCallback(async (party: Party) => {
    try {
      setLoadingOperations(true);
      setSelectedParty(party);
      setModalVisible(true);
      setOperations([]);

      const res = await api.get(`/admin/parties/${party.id}/operations`, { timeout: 30000 });
      const data = res.data?.operations ?? [];
      setOperations(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.log("❌ [AdminParties] error loading operations:", err?.message);
      setOperations([]);
    } finally {
      setLoadingOperations(false);
    }
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setSelectedParty(null);
    setOperations([]);
  }, []);

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
              <TouchableOpacity
                style={styles.partyCard}
                onPress={() => loadOperationsForParty(item)}
                activeOpacity={0.85}
              >
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
              </TouchableOpacity>
            )}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />
            }
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>

      {/* Modal com operações do cliente */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Operações de {selectedParty?.name || "Cliente"}
              </Text>
              <TouchableOpacity onPress={closeModal} activeOpacity={0.85} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>×</Text>
              </TouchableOpacity>
            </View>

            {loadingOperations ? (
              <View style={styles.modalLoading}>
                <TriadeLoading />
              </View>
            ) : operations.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Text style={styles.modalEmptyText}>Nenhuma operação encontrada.</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
                {operations.map((opName, index) => (
                  <View key={index} style={styles.operationItem}>
                    <Text style={styles.operationName}>{opName}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

export default AdminPartiesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#14395E",
    borderRadius: 16,
    width: "100%",
    maxWidth: 400,
    maxHeight: "80%",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#2F80ED44",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    flex: 1,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseText: {
    fontSize: 28,
    color: "#FFFFFF",
    lineHeight: 28,
  },
  modalLoading: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  modalEmpty: {
    padding: 40,
    alignItems: "center",
  },
  modalEmptyText: {
    color: "#C3C9D6",
    fontSize: 14,
  },
  modalList: {
    flex: 1,
  },
  modalListContent: {
    padding: 16,
    paddingBottom: 20,
  },
  operationItem: {
    backgroundColor: "#0E2A47",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  operationName: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "500",
  },
});
