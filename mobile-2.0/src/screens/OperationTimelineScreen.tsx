import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppStackParamList } from "../navigation/types";

import { api } from "../services/api";

const MAIN_BLUE = "#0E2A47";

type OperationFromApi = {
  id: string;
  name?: string;
  city?: string;
  state?: string;
  status?: string;

  // ✅ datas vindas da tabela operations (snake_case)
  auction_date?: string | null;
  itbi_date?: string | null;
  deed_date?: string | null;
  registry_date?: string | null;
  vacancy_date?: string | null;
  construction_date?: string | null;
  listed_to_broker_date?: string | null;
  sale_contract_date?: string | null;
  sale_receipt_date?: string | null;
};

type Props = NativeStackScreenProps<AppStackParamList, "OperationTimeline">;

export function OperationTimelineScreen({ navigation, route }: Props) {
  const { id, name, status } = route.params;

  const [operation, setOperation] = useState<OperationFromApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErrorMsg(null);
        setLoading(true);

        // ✅ estratégia simples: pega /operations e acha pelo id
        // (se você criar endpoint /operations/:id depois, eu adapto pra ficar ainda melhor)
        
        const res = await api.get(`/operation-costs/${encodeURIComponent(id)}`);
        const list = (res.data ?? []) as OperationFromApi[];

        const found = Array.isArray(list) ? list.find((op) => String(op.id) === String(id)) : null;

        if (!alive) return;

        if (!found) {
          setOperation(null);
          setErrorMsg("Operação não encontrada.");
          return;
        }

        setOperation(found);

        console.log("🧩 [Timeline] operation dates:", {
          auction_date: found.auction_date,
          itbi_date: found.itbi_date,
          deed_date: found.deed_date,
          registry_date: found.registry_date,
          vacancy_date: found.vacancy_date,
          construction_date: found.construction_date,
          listed_to_broker_date: found.listed_to_broker_date,
          sale_contract_date: found.sale_contract_date,
          sale_receipt_date: found.sale_receipt_date,
        });
      } catch (err: any) {
        if (!alive) return;
        console.log("❌ [Timeline] load error:", err?.response?.data ?? err?.message);
        setOperation(null);
        setErrorMsg("Não foi possível carregar a linha do tempo.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  const statusLabel =
    status === "concluida" ? "Concluída" : status === "em_andamento" ? "Em andamento" : "Em andamento";

  const steps = useMemo(() => {
    const op = operation;

    return [
      { key: "auction_date", label: "Arrematação", value: op?.auction_date },
      { key: "itbi_date", label: "Pagamento ITBI", value: op?.itbi_date },
      { key: "deed_date", label: "Escritura de compra e venda", value: op?.deed_date },
      { key: "registry_date", label: "Registro em matrícula", value: op?.registry_date },
      { key: "vacancy_date", label: "Desocupação", value: op?.vacancy_date },
      { key: "construction_date", label: "Obra / reforma", value: op?.construction_date },
      { key: "listed_to_broker_date", label: "Disponibilizado para imobiliária", value: op?.listed_to_broker_date },
      { key: "sale_contract_date", label: "Contrato de venda", value: op?.sale_contract_date },
      { key: "sale_receipt_date", label: "Recebimento da venda", value: op?.sale_receipt_date },
    ];
  }, [operation]);

  // ✅ último índice concluído (p/ pintar linha)
  const lastDoneIndex = useMemo(() => {
    let last = -1;
    steps.forEach((s, i) => {
      if (hasDate(s.value)) last = i;
    });
    return last;
  }, [steps]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header padrão */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8} style={styles.backBtn}>
            <Text style={styles.backText}>← Voltar</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Linha do tempo</Text>
          <View style={{ width: 70 }} />
        </View>

        {/* Cabeçalho */}
        <View style={styles.header}>
          <Text style={styles.title}>Linha do tempo</Text>
          <Text style={styles.subtitle}>Acompanhe as principais etapas dessa operação.</Text>
        </View>

        {/* Card principal */}
        <View style={styles.mainCard}>
          <Text style={styles.operationName}>{name ?? operation?.name ?? "Operação"}</Text>

          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusBadge,
                status === "concluida" ? styles.statusFinished : styles.statusActive,
              ]}
            >
              <Text style={styles.statusText}>{statusLabel}</Text>
            </View>
          </View>
        </View>

        {/* Loading / erro */}
        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.loadingText}>Carregando linha do tempo...</Text>
          </View>
        )}

        {!loading && errorMsg && (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* Timeline */}
        {!loading && !errorMsg && (
          <View style={styles.timelineContainer}>
            {steps.map((step, index) => {
              const done = hasDate(step.value);
              const isLast = index === steps.length - 1;
              const isCurrent = index === lastDoneIndex + 1 && !done;

              return (
                <View key={step.key} style={styles.timelineRow}>
                  {/* Bolinha + linha */}
                  <View style={styles.timelineIndicatorColumn}>
                    <View
                      style={[
                        styles.timelineDot,
                        done && styles.timelineDotDone,
                        isCurrent && !done && styles.timelineDotCurrent,
                      ]}
                    />
                    {!isLast && (
                      <View
                        style={[
                          styles.timelineLine,
                          index <= lastDoneIndex && styles.timelineLineDone,
                        ]}
                      />
                    )}
                  </View>

                  {/* Texto */}
                  <View style={styles.timelineTextColumn}>
                    <Text style={styles.stepLabel}>{step.label}</Text>

                    {/* ✅ aqui NÃO pode retornar "Pendente" */}
                    <Text style={styles.stepDate}>
                      {done ? formatTimelineDate(step.value) : "—"}
                    </Text>

                    {/* ✅ “Pendente” aparece só aqui */}
                    <Text style={styles.stepStatus}>{done ? "Concluído" : "Pendente"}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default OperationTimelineScreen;

function hasDate(value: any): boolean {
  if (!value) return false;
  const raw = String(value).trim();
  return raw !== "" && raw.toLowerCase() !== "null" && raw.toLowerCase() !== "undefined";
}

function formatTimelineDate(value: any): string {
  if (!value) return "—";

  // se vier "2025-12-18T..." ou "2025-12-18"
  const d = new Date(value);
  if (!isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");

  // fallback: mostra string bruta
  return String(value);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MAIN_BLUE },

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
    padding: 14,
    marginBottom: 20,
  },
  operationName: {
    fontSize: 18,
    color: "#FFFFFF",
    fontWeight: "600",
    marginBottom: 10,
  },

  statusRow: { flexDirection: "row" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusActive: { backgroundColor: "#2F80ED55" },
  statusFinished: { backgroundColor: "#27AE6055" },
  statusText: { color: "#FFFFFF", fontSize: 12, fontWeight: "500" },

  centerBox: { alignItems: "center", marginTop: 24 },
  loadingText: { marginTop: 8, color: "#D0D7E3", fontSize: 14 },
  errorText: { color: "#FFB4B4", fontSize: 14 },

  timelineContainer: { marginTop: 8 },

  timelineRow: { flexDirection: "row", marginBottom: 16 },
  timelineIndicatorColumn: { width: 24, alignItems: "center" },

  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#C3C9D6",
    backgroundColor: "#14395E",
  },
  timelineDotDone: { backgroundColor: "#27AE60", borderColor: "#27AE60" },
  timelineDotCurrent: { borderColor: "#F2C94C" },

  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 2,
    backgroundColor: "#2C4463",
  },
  timelineLineDone: { backgroundColor: "#27AE60" },

  timelineTextColumn: { flex: 1, marginLeft: 12 },

  stepLabel: { fontSize: 14, color: "#FFFFFF", fontWeight: "600" },
  stepDate: { fontSize: 13, color: "#D0D7E3", marginTop: 2 },
  stepStatus: { fontSize: 12, color: "#C3C9D6", marginTop: 2 },
});
