import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";

import { AppStackParamList } from "../navigation/types";
import { Screen } from "./Screen";
import { api } from "../services/api";

export type Investment = {
  id: string | number;
  propertyName?: string;
  city?: string;
  state?: string;
  status?: string; // "em_andamento" | "concluida"
  amountInvested?: number;
  totalInvestment?: number;
  realizedProfit?: number;
  netProfit?: number;
  totalCosts?: number;
  estimatedTerm?: string | number;
  realizedTerm?: string | number;
  roi?: number;
  documents?: {
    cartaArrematacao?: string;
    matriculaConsolidada?: string;
  };
};

type Props = NativeStackScreenProps<AppStackParamList, "Operations">;

async function fetchOperations(): Promise<Investment[]> {
  const { data } = await api.get("/operations");
  return data ?? [];
}

export function OperationsScreen({ navigation }: Props) {
  const [refreshing, setRefreshing] = useState(false);

  const operationsQuery = useQuery({
    queryKey: ["operations"],
    queryFn: fetchOperations,
  });

  const investments = operationsQuery.data ?? [];
  const loading = operationsQuery.isLoading;
  const errorMsg = operationsQuery.isError
    ? "Não foi possível carregar as operações do servidor."
    : null;

  const { activeInvestments, finishedInvestments } = useMemo(() => {
    const active = investments.filter((inv) => inv.status === "em_andamento");
    const finished = investments.filter((inv) => inv.status === "concluida");
    return { activeInvestments: active, finishedInvestments: finished };
  }, [investments]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await operationsQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }

  function openDetails(investment: Investment) {
    const roiRaw = investment.roi ?? 0;
    const roiPercent = roiRaw < 1 ? roiRaw * 100 : roiRaw;
    const amountInvestedValue = investment.amountInvested ?? 0;

    const expectedReturnCalc =
      amountInvestedValue && roiPercent
        ? amountInvestedValue * (roiPercent / 100)
        : 0;

    const docs = investment?.documents || {};
    const cartaArrematacao = docs?.cartaArrematacao || "";
    const matriculaConsolidada = docs?.matriculaConsolidada || "";

    navigation.navigate("OperationDetails", {
      id: String(investment.id),
      name: String(investment.propertyName ?? ""),
      city: String(investment.city ?? ""),
      state: String(investment.state ?? ""),
      status: String(investment.status ?? ""),
      amountInvested: String(amountInvestedValue),
      roi: String(roiRaw),
      expectedReturn: String(expectedReturnCalc),
      realizedProfit: String(investment.realizedProfit ?? 0),
      totalCosts: String(investment.totalCosts ?? 0),
      estimatedTerm: String(investment.estimatedTerm ?? ""),
      realizedTerm: String(investment.realizedTerm ?? ""),
      cartaArrematacao: String(cartaArrematacao),
      matriculaConsolidada: String(matriculaConsolidada),
    });
  }

  return (
    <Screen title="Minhas operações" padding={16} contentTopOffset={6}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 0 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFFFFF"
          />
        }
      >
        <Text style={styles.title}>Minhas operações</Text>
        <Text style={styles.subtitle}>
          Aqui você vê o detalhe de cada operação que investiu.
        </Text>

        {loading && <Text style={styles.loadingText}>Carregando operações...</Text>}

        {!loading && errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

        {!loading &&
          !errorMsg &&
          activeInvestments.length === 0 &&
          finishedInvestments.length === 0 && (
            <Text style={styles.emptyText}>
              Você ainda não possui operações cadastradas.
            </Text>
          )}

        {activeInvestments.length > 0 && !errorMsg && (
          <>
            <Text style={styles.sectionTitle}>Operações em andamento</Text>
            <FlatList
              data={activeInvestments}
              keyExtractor={(item) => String(item.id)}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => openDetails(item)}
                  activeOpacity={0.85}
                >
                  <InvestmentCard investment={item} />
                </TouchableOpacity>
              )}
            />
          </>
        )}

        {finishedInvestments.length > 0 && !errorMsg && (
          <>
            <Text style={[styles.sectionTitle, styles.finishedSectionTitle]}>
              Operações finalizadas
            </Text>
            <FlatList
              data={finishedInvestments}
              keyExtractor={(item) => String(item.id)}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => openDetails(item)}
                  activeOpacity={0.85}
                >
                  <InvestmentCard investment={item} />
                </TouchableOpacity>
              )}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function InvestmentCard({ investment }: { investment: Investment }) {
  const isActive = investment.status === "em_andamento";

  const roiRaw = investment.roi ?? 0;
  const roiPercentExpected = roiRaw < 1 ? roiRaw * 100 : roiRaw;

  const amount = investment.amountInvested || 0;
  const lucroRealizado = investment.realizedProfit || 0;
  const roiRealized =
    !isActive && amount > 0 ? (lucroRealizado / amount) * 100 : 0;

  const roiLabel = isActive ? "ROI esperado" : "ROI realizado";
  const roiDisplay = isActive ? roiPercentExpected : roiRealized;

  const expectedReturnCalc =
    (investment.amountInvested || 0) * (roiPercentExpected / 100);

  return (
    <View style={styles.investmentCard}>
      <View style={styles.investmentHeader}>
        <Text style={styles.investmentTitle}>{investment.propertyName}</Text>

        <View
          style={[
            styles.statusBadge,
            isActive ? styles.statusActive : styles.statusFinished,
          ]}
        >
          <Text style={styles.statusText}>
            {isActive ? "Em andamento" : "Concluída"}
          </Text>
        </View>
      </View>

      <Text style={styles.investmentLocation}>
        {investment.city} - {investment.state}
      </Text>

      <View style={styles.investmentRow}>
        <View style={styles.investmentColumn}>
          <Text style={styles.investmentLabel}>Valor investido</Text>
          <Text style={styles.investmentValue}>
            {formatCurrency(investment.amountInvested)}
          </Text>
        </View>

        <View style={styles.investmentColumn}>
          <Text style={styles.investmentLabel}>
            {isActive ? "Lucro esperado" : "Lucro realizado"}
          </Text>
          <Text style={styles.investmentValue}>
            {isActive
              ? formatCurrency(expectedReturnCalc)
              : formatCurrency(investment.realizedProfit || 0)}
          </Text>
        </View>

        <View style={styles.investmentColumn}>
          <Text style={styles.investmentLabel}>{roiLabel}</Text>
          <Text style={styles.investmentValue}>{roiDisplay.toFixed(1)}%</Text>
        </View>
      </View>
    </View>
  );
}

function formatCurrency(value: number | undefined): string {
  const v = value ?? 0;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const styles = StyleSheet.create({
  title: { fontSize: 22, color: "#FFFFFF", fontWeight: "600" },
  subtitle: { fontSize: 14, color: "#D0D7E3", marginTop: 4, marginBottom: 16 },
  loadingText: { color: "#D0D7E3", fontSize: 14, marginTop: 12 },
  emptyText: { color: "#D0D7E3", fontSize: 14, marginTop: 12 },
  errorText: { color: "#FFB4B4", fontSize: 14, marginTop: 12 },
  sectionTitle: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 12,
  },
  finishedSectionTitle: { marginTop: 20 },
  separator: { height: 12 },

  investmentCard: { backgroundColor: "#14395E", padding: 14, borderRadius: 12 },
  investmentHeader: { flexDirection: "row", justifyContent: "space-between" },
  investmentTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    marginRight: 10,
  },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusActive: { backgroundColor: "#2F80ED44" },
  statusFinished: { backgroundColor: "#27AE6044" },
  statusText: { color: "#FFFFFF", fontSize: 12 },

  investmentLocation: { color: "#C5D2E0", fontSize: 12, marginTop: 4 },
  investmentRow: { flexDirection: "row", marginTop: 12 },
  investmentColumn: { flex: 1 },
  investmentLabel: { color: "#C3C9D6", fontSize: 12 },
  investmentValue: { color: "#FFFFFF", fontSize: 14, fontWeight: "600", marginTop: 2 },
});
