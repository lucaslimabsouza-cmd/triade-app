import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import TriadeLoading from "../ui/TriadeLoading";
import AppHeader from "../ui/AppHeader";
import { api } from "../services/api";

import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppStackParamList } from "../navigation/types";

const MAIN_BLUE = "#0E2A47";

type Operation = {
  id: string | number;
  propertyName?: string;
  city?: string;
  state?: string;
  status?: "em_andamento" | "concluida" | string;
  amountInvested?: number;
  totalInvestment?: number;
  roi?: number;
  realizedProfit?: number;
  netProfit?: number;
  totalCosts?: number;
  estimatedTerm?: string;
  realizedTerm?: string;
  documents?: {
    cartaArrematacao?: string;
    matriculaConsolidada?: string;
  };
};

type Props = NativeStackScreenProps<AppStackParamList, "Operations">;

export function OperationsScreen({ navigation }: Props) {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setErrorMsg(null);
        if (!alive) return;
        setLoading(true);

        const res = await api.get("/operations");
        const data = (res.data ?? []) as Operation[];

        if (!alive) return;
        setOperations(Array.isArray(data) ? data : []);
      } catch (err: any) {
        console.log("❌ [OperationsScreen] load error:", err?.message, err?.response?.data);
        if (!alive) return;
        setOperations([]);
        setErrorMsg("Não foi possível carregar as operações do servidor.");
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

  const { activeOps, finishedOps } = useMemo(() => {
    const active = operations.filter((op) => op.status === "em_andamento");
    const finished = operations.filter((op) => op.status === "concluida");
    return { activeOps: active, finishedOps: finished };
  }, [operations]);

  function openDetails(op: Operation) {
    const roiRaw = Number(op.roi ?? 0);
    const roiPercentExpected = roiRaw < 1 ? roiRaw * 100 : roiRaw;

    const amountInvestedValue = Number(op.amountInvested ?? op.totalInvestment ?? 0);

    const expectedReturnCalc =
      amountInvestedValue && roiPercentExpected
        ? amountInvestedValue * (roiPercentExpected / 100)
        : 0;

    const docs = op.documents ?? {};
    const cartaArrematacao = docs.cartaArrematacao ?? "";
    const matriculaConsolidada = docs.matriculaConsolidada ?? "";

    navigation.navigate("OperationDetails", {
      id: String(op.id),
      name: String(op.propertyName ?? ""),
      city: String(op.city ?? ""),
      state: String(op.state ?? ""),
      status: String(op.status ?? ""),
      amountInvested: String(amountInvestedValue),
      roi: String(roiRaw),
      expectedReturn: String(expectedReturnCalc),
      realizedProfit: String(op.realizedProfit ?? op.netProfit ?? 0),
      totalCosts: String(op.totalCosts ?? 0),
      estimatedTerm: String(op.estimatedTerm ?? ""),
      realizedTerm: String(op.realizedTerm ?? ""),
      cartaArrematacao: String(cartaArrematacao),
      matriculaConsolidada: String(matriculaConsolidada),
      contratoScp: op.documents?.contratoScp ?? "",
    });
  }

  if (loading) return <TriadeLoading />;

  const hasNone = !errorMsg && activeOps.length === 0 && finishedOps.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppHeader title="Operações" onBack={() => navigation.goBack()} />

        <Text style={styles.title}>Minhas operações</Text>
        <Text style={styles.subtitle}>
          Aqui você vê o detalhe de cada operação que investiu.
        </Text>

        {!!errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

        {hasNone && (
          <Text style={styles.emptyText}>
            Você ainda não possui operações cadastradas.
          </Text>
        )}

        {activeOps.length > 0 && !errorMsg && (
          <>
            <Text style={styles.sectionTitle}>Operações em andamento</Text>
            <FlatList
              data={activeOps}
              keyExtractor={(item) => String(item.id)}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => openDetails(item)} activeOpacity={0.85}>
                  <OperationCard operation={item} />
                </TouchableOpacity>
              )}
            />
          </>
        )}

        {finishedOps.length > 0 && !errorMsg && (
          <>
            <Text style={[styles.sectionTitle, styles.finishedSectionTitle]}>
              Operações finalizadas
            </Text>
            <FlatList
              data={finishedOps}
              keyExtractor={(item) => String(item.id)}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => openDetails(item)} activeOpacity={0.85}>
                  <OperationCard operation={item} />
                </TouchableOpacity>
              )}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default OperationsScreen;

function OperationCard({ operation }: { operation: Operation }) {
  const isActive = operation.status === "em_andamento";

  const roiRaw = Number(operation.roi ?? 0);
  const roiPercentExpected = roiRaw < 1 ? roiRaw * 100 : roiRaw;

  const amount = Number(operation.amountInvested ?? operation.totalInvestment ?? 0);
  const lucroRealizado = Number(operation.realizedProfit ?? operation.netProfit ?? 0);

  const roiRealized = !isActive && amount > 0 ? (lucroRealizado / amount) * 100 : 0;

  const roiLabel = isActive ? "ROI esperado" : "ROI realizado";
  const roiDisplay = isActive ? roiPercentExpected : roiRealized;

  const expectedReturnCalc = amount * (roiPercentExpected / 100);

  return (
    <View style={styles.investmentCard}>
      <View style={styles.investmentHeader}>
        <Text style={styles.investmentTitle}>{operation.propertyName ?? "Operação"}</Text>

        <View style={[styles.statusBadge, isActive ? styles.statusActive : styles.statusFinished]}>
          <Text style={styles.statusText}>{isActive ? "Em andamento" : "Concluída"}</Text>
        </View>
      </View>

      <Text style={styles.investmentLocation}>
        {operation.city ?? ""} {operation.state ? `- ${operation.state}` : ""}
      </Text>

      <View style={styles.investmentRow}>
        <View style={styles.investmentColumn}>
          <Text style={styles.investmentLabel}>Valor investido</Text>
          <Text style={styles.investmentValue}>{formatCurrency(amount)}</Text>
        </View>

        <View style={styles.investmentColumn}>
          <Text style={styles.investmentLabel}>
            {isActive ? "Lucro esperado" : "Lucro realizado"}
          </Text>
          <Text style={styles.investmentValue}>
            {isActive ? formatCurrency(expectedReturnCalc) : formatCurrency(lucroRealizado)}
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

function formatCurrency(value: number): string {
  const v = Number.isFinite(value) ? value : 0;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MAIN_BLUE },

  // ✅ padrão de topo
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 48 },

  title: { fontSize: 22, color: "#FFFFFF", fontWeight: "600" },
  subtitle: { fontSize: 14, color: "#D0D7E3", marginTop: 4, marginBottom: 16 },

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
  investmentTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "600", flex: 1, marginRight: 10 },

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
