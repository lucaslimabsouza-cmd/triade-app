// src/screens/OperationDetailsScreen.tsx

import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppStackParamList } from "../navigation/types";

const MAIN_BLUE = "#0E2A47";

function normalizeUrl(u?: string | null) {
  const raw = String(u ?? "").trim();
  if (!raw) return null;
  if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
    return `https://${raw}`;
  }
  return raw;
}

async function openUrl(url: string) {
  try {
    const can = await Linking.canOpenURL(url);
    if (!can) {
      Alert.alert("Link inválido", "Não foi possível abrir este link.");
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert("Erro", "Não foi possível abrir este link.");
  }
}

type Props = NativeStackScreenProps<AppStackParamList, "OperationDetails">;

export function OperationDetailsScreen({ navigation, route }: Props) {
  const params = route.params;

  const isFinished = params.status === "concluida";

  const cartaUrl = normalizeUrl(params.cartaArrematacao);
  const matriculaUrl = normalizeUrl(params.matriculaConsolidada);

  const estimatedTermLabel =
    params.estimatedTerm && params.estimatedTerm !== ""
      ? `${params.estimatedTerm} meses`
      : "—";

  const realizedTermLabel =
    isFinished && params.realizedTerm && params.realizedTerm !== ""
      ? `${params.realizedTerm} meses`
      : "—";

  const roiRaw = Number(params.roi ?? 0);
  const roiPercent = roiRaw < 1 ? roiRaw * 100 : roiRaw;

  const amountInvestedValue = Number(params.amountInvested ?? 0);

  const expectedReturnValue =
    amountInvestedValue && roiPercent
      ? amountInvestedValue * (roiPercent / 100)
      : 0;

  const operation = {
    id: params.id ?? "",
    name: params.name ?? "Operação",
    city: params.city ?? "Cidade",
    state: params.state ?? "UF",
    status:
      params.status === "em_andamento"
        ? "Em andamento"
        : params.status === "concluida"
        ? "Concluída"
        : "Em andamento",
    amountInvested: amountInvestedValue,
    expectedReturn: expectedReturnValue,
    realizedProfit: Number(params.realizedProfit ?? 0),
    roi: roiPercent,
    estimatedTerm: estimatedTermLabel,
    realizedTerm: realizedTermLabel,
    totalCosts: Number(params.totalCosts ?? 0),
  };

  const realizedRoi =
    isFinished && operation.amountInvested > 0
      ? (operation.realizedProfit / operation.amountInvested) * 100
      : 0;

  function goToTimeline() {
    navigation.navigate("OperationTimeline", {
      id: String(operation.id),
      name: String(operation.name),
      status: params.status,
    });
  }

  function goToCosts() {
    navigation.navigate("OperationCosts", {
      id: String(operation.id),
      name: String(operation.name),
    });
  }

  function handleOpenDoc(url: string | null, label: string) {
    if (!url) {
      Alert.alert("Ainda não disponível", `${label} ainda não está disponível.`);
      return;
    }
    openUrl(url);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header padrão */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
            style={styles.backBtn}
          >
            <Text style={styles.backText}>← Voltar</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Detalhes</Text>
          <View style={{ width: 70 }} />
        </View>

        {/* Cabeçalho */}
        <View style={styles.header}>
          <Text style={styles.title}>Detalhes da operação</Text>
          <Text style={styles.subtitle}>
            Acompanhe de perto o andamento da sua operação.
          </Text>
        </View>

        {/* Card principal */}
        <View style={styles.mainCard}>
          <Text style={styles.propertyName}>{operation.name}</Text>
          <Text style={styles.location}>
            {operation.city} - {operation.state}
          </Text>

          <View style={styles.statusRow}>
            <View
              style={[
                styles.chip,
                params.status === "concluida"
                  ? styles.statusChipFinished
                  : styles.statusChipActive,
              ]}
            >
              <Text style={styles.chipText}>{operation.status}</Text>
            </View>
          </View>

          <View style={styles.termColumn}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>
                Prazo estimado: {operation.estimatedTerm}
              </Text>
            </View>

            {isFinished && operation.realizedTerm !== "—" && (
              <View style={[styles.chip, styles.realizedTermChip]}>
                <Text style={styles.chipText}>
                  Prazo realizado: {operation.realizedTerm}
                </Text>
              </View>
            )}
          </View>

          {/* ✅ Linha do tempo */}
          <TouchableOpacity
            style={styles.timelineLink}
            activeOpacity={0.8}
            onPress={goToTimeline}
          >
            <Text style={styles.timelineLinkText}>Ver linha do tempo →</Text>
          </TouchableOpacity>
        </View>

        {/* Resumo financeiro */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumo financeiro</Text>

          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Valor investido</Text>
              <Text style={styles.metricValue}>
                {formatCurrency(operation.amountInvested)}
              </Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Lucro esperado</Text>
              <Text style={styles.metricValue}>
                {formatCurrency(operation.expectedReturn)}
              </Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>ROI % esperado</Text>
              <Text style={styles.metricValue}>{`${operation.roi.toFixed(1)}%`}</Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Lucro realizado</Text>
              <Text style={styles.metricValue}>
                {isFinished ? formatCurrency(operation.realizedProfit) : "—"}
              </Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>ROI % realizado</Text>
              <Text style={styles.metricValue}>
                {isFinished && realizedRoi > 0 ? `${realizedRoi.toFixed(1)}%` : "—"}
              </Text>
            </View>
          </View>
        </View>

        {/* Custos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Custos do projeto</Text>

          <TouchableOpacity
            style={styles.costCard}
            activeOpacity={0.8}
            onPress={goToCosts}
          >
            <Text style={styles.metricLabel}>Total de custos</Text>
            <Text style={styles.metricValue}>
              {formatCurrency(operation.totalCosts)}
            </Text>
            <Text style={styles.costHint}>Ver custos detalhados →</Text>
          </TouchableOpacity>
        </View>

        {/* Documentos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Documentos e anexos</Text>

          <View style={styles.docsCard}>
            <DocRow
              label="Carta de arrematação"
              available={!!cartaUrl}
              onPress={() => handleOpenDoc(cartaUrl, "Carta de arrematação")}
            />

            <View style={styles.docDivider} />

            <DocRow
              label="Matrícula consolidada"
              available={!!matriculaUrl}
              onPress={() => handleOpenDoc(matriculaUrl, "Matrícula consolidada")}
            />
          </View>

          {!cartaUrl && !matriculaUrl && (
            <Text style={styles.docsEmptyHint}>Ainda não disponível.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default OperationDetailsScreen;

function DocRow({
  label,
  available,
  onPress,
}: {
  label: string;
  available: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={!available}
      style={[styles.docRow, !available && styles.docRowDisabled]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.docLabel}>{label}</Text>
        <Text style={styles.docStatus}>
          {available ? "Abrir documento →" : "Ainda não disponível"}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MAIN_BLUE },

  // ✅ padrão “descer”
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  backBtn: { width: 70, paddingVertical: 6 },
  backText: { color: "#8AB4FF", fontSize: 13, fontWeight: "700" },
  headerTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },

  header: { marginBottom: 16 },
  title: { fontSize: 22, color: "#FFFFFF", fontWeight: "600" },
  subtitle: { fontSize: 14, color: "#D0D7E3", marginTop: 4 },

  mainCard: {
    backgroundColor: "#14395E",
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  propertyName: { fontSize: 18, color: "#FFFFFF", fontWeight: "600" },
  location: { fontSize: 13, color: "#C5D2E0", marginTop: 4 },

  statusRow: { flexDirection: "row", marginTop: 12 },
  termColumn: { marginTop: 8, alignSelf: "flex-start", gap: 8 },

  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#1E4A75",
  },
  statusChipActive: { backgroundColor: "#2F80ED55" },
  statusChipFinished: { backgroundColor: "#27AE6055" },
  realizedTermChip: { backgroundColor: "#27AE6055" },
  chipText: { color: "#FFFFFF", fontSize: 11, fontWeight: "500" },

  timelineLink: { marginTop: 10 },
  timelineLinkText: { color: "#8AB4FF", fontSize: 12, fontWeight: "700" },

  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 18,
    color: "#FFFFFF",
    fontWeight: "600",
    marginBottom: 10,
  },

  metricsRow: { flexDirection: "row", gap: 12, marginBottom: 10 },
  metricCard: {
    flex: 1,
    backgroundColor: "#14395E",
    borderRadius: 12,
    padding: 12,
  },
  metricLabel: { fontSize: 12, color: "#C3C9D6" },
  metricValue: {
    fontSize: 15,
    color: "#FFFFFF",
    fontWeight: "600",
    marginTop: 4,
  },

  costCard: { backgroundColor: "#14395E", borderRadius: 12, padding: 14 },
  costHint: { color: "#8AB4FF", fontSize: 12, marginTop: 8, fontWeight: "600" },

  docsCard: { backgroundColor: "#14395E", borderRadius: 12, overflow: "hidden" },
  docRow: { padding: 14 },
  docRowDisabled: { opacity: 0.6 },
  docLabel: { color: "#FFFFFF", fontSize: 14, fontWeight: "600", marginBottom: 4 },
  docStatus: { color: "#8AB4FF", fontSize: 12, fontWeight: "600" },
  docDivider: { height: 1, backgroundColor: "#1F4C78" },
  docsEmptyHint: { color: "#C3C9D6", fontSize: 12, marginTop: 8 },
});
