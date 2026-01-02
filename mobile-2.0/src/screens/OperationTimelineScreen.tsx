import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppStackParamList } from "../navigation/types";

import { api } from "../services/api";

import { cacheGet, getOrFetch } from "../cache/memoryCache";
import { CACHE_KEYS } from "../cache/cacheKeys";

const MAIN_BLUE = "#0E2A47";

type OperationFromApi = {
  id: string;
  propertyName?: string;
  name?: string;
  city?: string;
  state?: string;
  status?: string;

  // ✅ datas vindas do backend (snake_case)
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
  const params = route.params as any;
  const id = String(params.id ?? "");
  const name = params.name;
  const status = params.status;

  const [operation, setOperation] = useState<OperationFromApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    function pickFromList(list: OperationFromApi[] | any) {
      const found = Array.isArray(list)
        ? list.find((op) => String(op.id) === String(id))
        : null;

      console.log("🧩 [Timeline] route.params =", params);
      console.log(
        "🧩 [Timeline] /operations count =",
        Array.isArray(list) ? list.length : "not-array"
      );
      console.log("🧩 [Timeline] looking for id =", id);
      console.log("🧩 [Timeline] found =", found);

      if (!found) {
        setOperation(null);
        setErrorMsg("Operação não encontrada no /operations.");
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
    }

    (async () => {
      try {
        setErrorMsg(null);

        // ✅ 1) tenta cache instantâneo
        const cachedList = cacheGet<OperationFromApi[]>(CACHE_KEYS.OPERATIONS);
        if (cachedList && cachedList.length > 0) {
          if (!alive) return;
          setLoading(false);
          pickFromList(cachedList);
        } else {
          setLoading(true);
        }

        // ✅ 2) garante lista (cache ou servidor) e atualiza
        const list = await getOrFetch(CACHE_KEYS.OPERATIONS, async () => {
          const res = await api.get("/operations");
          return (res.data ?? []) as OperationFromApi[];
        });

        if (!alive) return;
        pickFromList(list);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const statusLabel =
    status === "concluida"
      ? "Concluída"
      : status === "em_andamento"
      ? "Em andamento"
      : "Em andamento";

  const steps = useMemo(() => {
    const op = operation;

    return [
      { key: "auction_date", label: "Arrematação", value: op?.auction_date },
      { key: "itbi_date", label: "Pagamento ITBI", value: op?.itbi_date },
      { key: "deed_date", label: "Escritura de compra e venda", value: op?.deed_date },
      { key: "registry_date", label: "Registro em matrícula", value: op?.registry_date },
      { key: "vacancy_date", label: "Desocupação", value: op?.vacancy_date },
      { key: "construction_date", label: "Obra / reforma", value: op?.construction_date },
      {
        key: "listed_to_broker_date",
        label: "Disponibilizado para imobiliária",
        value: op?.listed_to_broker_date,
      },
      { key: "sale_contract_date", label: "Contrato de venda", value: op?.sale_contract_date },
      { key: "sale_receipt_date", label: "Recebimento da venda", value: op?.sale_receipt_date },
    ];
  }, [operation]);

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
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
            style={styles.backBtn}
          >
            <Text style={styles.backText}>← Voltar</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}></Text>
          <View style={{ width: 70 }} />
        </View>

        {/* Cabeçalho */}
        <View style={styles.header}>
          <Text style={styles.title}>Linha do tempo</Text>
          <Text style={styles.subtitle}>
            Acompanhe as principais etapas dessa operação.
          </Text>
        </View>

        {/* Card principal */}
        <View style={styles.mainCard}>
          <Text style={styles.operationName}>
            {name ?? operation?.propertyName ?? operation?.name ?? "Operação"}
          </Text>

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

                  <View style={styles.timelineTextColumn}>
                    <Text style={styles.stepLabel}>{step.label}</Text>
                    <Text style={styles.stepDate}>
                      {done ? formatTimelineDate(step.value) : "—"}
                    </Text>
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
  const d = new Date(value);
  if (!isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
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
