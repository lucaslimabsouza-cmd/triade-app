import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppStackParamList } from "../navigation/types";
import { Screen } from "./Screen";

type Props = NativeStackScreenProps<AppStackParamList, "OperationDetails">;

function formatCurrency(value: number): string {
  return (value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function OperationDetailsScreen({ route }: Props) {
  const p = route.params;

  const isActive = (p.status ?? "") === "em_andamento";

  const amountInvested = Number(p.amountInvested ?? 0);
  const roiRaw = Number(p.roi ?? 0);
  const roiExpected = roiRaw < 1 ? roiRaw * 100 : roiRaw;

  const realizedProfit = Number(p.realizedProfit ?? 0);
  const roiRealized = useMemo(() => {
    if (amountInvested <= 0) return 0;
    return (realizedProfit / amountInvested) * 100;
  }, [amountInvested, realizedProfit]);

  const roiLabel = isActive ? "ROI esperado" : "ROI realizado";
  const roiDisplay = isActive ? roiExpected : roiRealized;

  const expectedReturn = Number(p.expectedReturn ?? 0);
  const totalCosts = Number(p.totalCosts ?? 0);

  async function openLink(url?: string) {
    if (!url) return;
    const u = String(url).trim();
    if (!u) return;
    const can = await Linking.canOpenURL(u);
    if (!can) return;
    Linking.openURL(u);
  }

  return (
    <Screen title="Detalhes da operação" padding={16} contentTopOffset={6}>
      <Text style={styles.title}>{p.name || "Operação"}</Text>
      <Text style={styles.subtitle}>
        {(p.city || "") + (p.state ? ` - ${p.state}` : "")}
      </Text>

      <View style={styles.card}>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, isActive ? styles.badgeActive : styles.badgeFinished]}>
            <Text style={styles.badgeText}>{isActive ? "Em andamento" : "Concluída"}</Text>
          </View>
        </View>

        <View style={styles.row3}>
          <Info label="Valor investido" value={formatCurrency(amountInvested)} />
          <Info
            label={isActive ? "Lucro esperado" : "Lucro realizado"}
            value={formatCurrency(isActive ? expectedReturn : realizedProfit)}
          />
          <Info label={roiLabel} value={`${roiDisplay.toFixed(1)}%`} />
        </View>

        <View style={styles.row2}>
          <Info label="Custos totais" value={formatCurrency(totalCosts)} />
          <Info label="Prazo estimado" value={String(p.estimatedTerm ?? "-")} />
        </View>

        <View style={styles.row2}>
          <Info label="Prazo realizado" value={String(p.realizedTerm ?? "-")} />
          <Info label="ID" value={String(p.id)} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Documentos</Text>

        <DocItem
          label="Carta de arrematação"
          url={p.cartaArrematacao}
          onPress={() => openLink(p.cartaArrematacao)}
        />
        <DocItem
          label="Matrícula consolidada"
          url={p.matriculaConsolidada}
          onPress={() => openLink(p.matriculaConsolidada)}
        />
      </View>
    </Screen>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function DocItem({
  label,
  url,
  onPress,
}: {
  label: string;
  url?: string;
  onPress: () => void;
}) {
  const disabled = !url || String(url).trim() === "";
  return (
    <TouchableOpacity
      style={[styles.docRow, disabled ? { opacity: 0.4 } : null]}
      activeOpacity={0.85}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={styles.docLabel}>{label}</Text>
      <Ionicons name="open-outline" size={18} color="#FFFFFF" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, color: "#FFFFFF", fontWeight: "700", marginTop: 6 },
  subtitle: { fontSize: 13, color: "#D0D7E3", marginTop: 4, marginBottom: 14 },

  card: { backgroundColor: "#14395E", borderRadius: 12, padding: 14 },
  badgeRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeActive: { backgroundColor: "#2F80ED44" },
  badgeFinished: { backgroundColor: "#27AE6044" },
  badgeText: { color: "#FFFFFF", fontSize: 12 },

  row3: { flexDirection: "row", gap: 10 },
  row2: { flexDirection: "row", gap: 10, marginTop: 12 },

  infoLabel: { color: "#C3C9D6", fontSize: 12 },
  infoValue: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", marginTop: 2 },

  section: { marginTop: 18 },
  sectionTitle: { fontSize: 16, color: "#FFFFFF", fontWeight: "700", marginBottom: 8 },

  docRow: {
    backgroundColor: "#14395E",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  docLabel: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
});
