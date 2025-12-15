// mobile/app/operation-timeline.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Investment } from "../lib/models";
import { API_BASE_URL } from "../lib/config";

const MAIN_BLUE = "#0E2A47";

export default function OperationTimelineScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    name?: string;
    status?: string;
  }>();

  const [operation, setOperation] = useState<Investment | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Carrega a operação pelo ID vindo por params
  useEffect(() => {
    async function loadOperation() {
      try {
        setErrorMsg(null);
        setLoading(true);

        const res = await fetch(`${API_BASE_URL}/operations`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = (await res.json()) as Investment[];

        const found = data.find((op) => op.id === params.id);
        if (!found) {
          setErrorMsg("Operação não encontrada.");
          setOperation(null);
        } else {
          setOperation(found);
        }
      } catch (error: any) {
        console.error("❌ Erro ao carregar operação para timeline:", error);
        setErrorMsg("Não foi possível carregar a linha do tempo.");
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      loadOperation();
    } else {
      setErrorMsg("ID da operação não informado.");
      setLoading(false);
    }
  }, [params.id]);

  const statusLabel =
    params.status === "concluida"
      ? "Concluída"
      : params.status === "em_andamento"
      ? "Em andamento"
      : "Em andamento";

  // Monta os passos da linha do tempo a partir do objeto timeline
  const steps = (() => {
    const tl = operation?.timeline ?? {};

    return [
      {
        key: "dataArrematacao",
        label: "Arrematação",
        value: tl.dataArrematacao,
      },
      {
        key: "dataITBI",
        label: "Pagamento ITBI",
        value: tl.dataITBI,
      },
      {
        key: "dataEscritura",
        label: "Escritura de compra e venda",
        value: tl.dataEscritura,
      },
      {
        key: "dataMatricula",
        label: "Registro em matrícula",
        value: tl.dataMatricula,
      },
      {
        key: "dataDesocupacao",
        label: "Desocupação",
        value: tl.dataDesocupacao,
      },
      {
        key: "dataObra",
        label: "Obra / reforma",
        value: tl.dataObra,
      },
      {
        key: "dataDisponibilizadoImobiliaria",
        label: "Disponibilizado para imobiliária",
        value: tl.dataDisponibilizadoImobiliaria,
      },
      {
        key: "dataContratoVenda",
        label: "Contrato de venda",
        value: tl.dataContratoVenda,
      },
      {
        key: "dataRecebimentoVenda",
        label: "Recebimento da venda",
        value: tl.dataRecebimentoVenda,
      },
    ];
  })();

  // índice do último passo concluído
  const lastDoneIndex = steps.reduce((acc, step, index) => {
    if (step.value) return index;
    return acc;
  }, -1);

  return (
<SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Cabeçalho */}
        <View style={styles.header}>
          <Text style={styles.title}>Linha do tempo</Text>
          <Text style={styles.subtitle}>
            Acompanhe as principais etapas dessa operação.
          </Text>
        </View>

        {/* Card principal com nome e status */}
        <View style={styles.mainCard}>
          <Text style={styles.operationName}>
            {params.name ?? operation?.propertyName ?? "Operação"}
          </Text>
          <View style={styles.headerRow}>
            <Text style={styles.operationId}>ID: {params.id}</Text>

            <View
              style={[
                styles.statusBadge,
                params.status === "concluida"
                  ? styles.statusFinished
                  : styles.statusActive,
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
              const done = !!step.value;
              const isLast = index === steps.length - 1;
              const isCurrent = index === lastDoneIndex + 1 && !done;

              return (
                <View key={step.key} style={styles.timelineRow}>
                  {/* Coluna da bolinha + linha */}
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
                          index < lastDoneIndex && styles.timelineLineDone,
                        ]}
                      />
                    )}
                  </View>

                  {/* Texto do passo */}
                  <View style={styles.timelineTextColumn}>
                    <Text style={styles.stepLabel}>{step.label}</Text>
                    <Text style={styles.stepDate}>
                      {formatTimelineDate(step.value)}
                    </Text>
                    <Text style={styles.stepStatus}>
                      {done ? "Concluído" : "Pendente"}
                    </Text>
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

// Converte número de série do Excel para Date
function excelSerialToDate(serial: number): Date | null {
  if (typeof serial !== "number" || !isFinite(serial)) return null;
  const excelEpoch = new Date(1899, 11, 30);
  const millis = excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000;
  return new Date(millis);
}

function formatTimelineDate(value: any): string {
  if (!value && value !== 0) return "Pendente";

  if (typeof value === "number") {
    const d = excelSerialToDate(value);
    if (!d || isNaN(d.getTime())) return "Pendente";
    return d.toLocaleDateString("pt-BR");
  }

  const d = new Date(value);
  if (isNaN(d.getTime())) return "Pendente";
  return d.toLocaleDateString("pt-BR");
}

// Estilos
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MAIN_BLUE,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 14,
    color: "#D0D7E3",
    marginTop: 4,
  },
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
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  operationId: {
    fontSize: 13,
    color: "#C5D2E0",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusActive: {
    backgroundColor: "#2F80ED55",
  },
  statusFinished: {
    backgroundColor: "#27AE6055",
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "500",
  },
  centerBox: {
    alignItems: "center",
    marginTop: 24,
  },
  loadingText: {
    marginTop: 8,
    color: "#D0D7E3",
    fontSize: 14,
  },
  errorText: {
    color: "#FFB4B4",
    fontSize: 14,
  },
  timelineContainer: {
    marginTop: 8,
  },
  timelineRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  timelineIndicatorColumn: {
    width: 24,
    alignItems: "center",
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#C3C9D6",
    backgroundColor: "#14395E",
  },
  timelineDotDone: {
    backgroundColor: "#27AE60",
    borderColor: "#27AE60",
  },
  timelineDotCurrent: {
    borderColor: "#F2C94C",
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 2,
    backgroundColor: "#2C4463",
  },
  timelineLineDone: {
    backgroundColor: "#27AE60",
  },
  timelineTextColumn: {
    flex: 1,
    marginLeft: 12,
  },
  stepLabel: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  stepDate: {
    fontSize: 13,
    color: "#D0D7E3",
    marginTop: 2,
  },
  stepStatus: {
    fontSize: 12,
    color: "#C3C9D6",
    marginTop: 2,
  },
});
