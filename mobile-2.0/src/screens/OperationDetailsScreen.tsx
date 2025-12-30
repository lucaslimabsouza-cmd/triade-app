// src/screens/OperationDetailsScreen.tsx

import React, { useMemo, useEffect, useState } from "react";
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
import { api } from "../services/api";

import { cacheGet, getOrFetch } from "../cache/memoryCache";
import { CACHE_KEYS } from "../cache/cacheKeys";

const MAIN_BLUE = "#0E2A47";

/* =========================
   Utils
========================= */

function normalizeUrl(u?: string | null) {
  const raw = String(u ?? "").trim();
  if (!raw) return null;
  if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
    return `https://${raw}`;
  }
  return raw;
}

function isValidUuid(u?: string) {
  if (!u) return false;
  const s = String(u).trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    s
  );
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

function formatCurrency(value: number): string {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function roiToPercent(roi: any) {
  const r = Number(roi ?? 0);
  return r < 1 ? r * 100 : r;
}

/**
 * ✅ TotalCosts pode vir com nomes diferentes dependendo do backend.
 * Esta função tenta vários campos e cai pra 0.
 */
function pickTotalCosts(payload: any): number {
  const d = payload ?? {};
  const candidates = [
    d.totalCosts,
    d.total_costs,
    d.total,
    d.sum,
    d.total_cost,
    d.totalCostsValue,
    d?.data?.totalCosts,
    d?.data?.total_costs,
    d?.data?.total,
  ];

  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n)) return n;
  }

  return 0;
}

type Props = NativeStackScreenProps<AppStackParamList, "OperationDetails">;

function OperationDetailsScreen({ navigation, route }: Props) {
  const params = route.params as any;

  // ✅ pega um UUID "limpo"
  const operationId = useMemo(() => {
    const raw = String(
      params?.id ??
        params?.operation_id ??
        params?.operationId ??
        params?.uuid ??
        ""
    ).trim();
    return raw;
  }, [params]);

  const validOperationId = isValidUuid(operationId);

  const statusParam = String(params.status ?? "em_andamento");
  const isFinished = statusParam === "concluida";

  const docs = useMemo(() => {
    const d = params?.documents ?? {};
    return {
      cartaArrematacao: d.cartaArrematacao ?? params?.cartaArrematacao ?? "",
      matriculaConsolidada:
        d.matriculaConsolidada ?? params?.matriculaConsolidada ?? "",
      contratoScp: d.contratoScp ?? params?.contratoScp ?? "",
    };
  }, [params]);

  const cartaUrl = normalizeUrl(docs.cartaArrematacao);
  const matriculaUrl = normalizeUrl(docs.matriculaConsolidada);
  const contratoScpUrl = normalizeUrl(docs.contratoScp);

  const estimatedTermLabel =
    params.estimatedTerm && params.estimatedTerm !== ""
      ? `${params.estimatedTerm} meses`
      : "—";

  const realizedTermLabel =
    isFinished && params.realizedTerm && params.realizedTerm !== ""
      ? `${params.realizedTerm} meses`
      : "—";

  const roiExpectedPercent = roiToPercent(params.roi);

  const operation = useMemo(
    () => ({
      id: operationId,
      name: params.name ?? params.propertyName ?? "Operação",
      city: params.city ?? "Cidade",
      state: params.state ?? "UF",
      status:
        statusParam === "em_andamento"
          ? "Em andamento"
          : statusParam === "concluida"
          ? "Concluída"
          : "Em andamento",
      estimatedTerm: estimatedTermLabel,
      realizedTerm: realizedTermLabel,
      totalCosts: Number(params.totalCosts ?? 0),
    }),
    [
      operationId,
      params.name,
      params.propertyName,
      params.city,
      params.state,
      params.totalCosts,
      statusParam,
      estimatedTermLabel,
      realizedTermLabel,
    ]
  );

  /**
   * ✅ Resumo financeiro
   */
  const [loadingFinance, setLoadingFinance] = useState(false);
  const [amountInvested, setAmountInvested] = useState<number>(0);
  const [expectedProfit, setExpectedProfit] = useState<number>(0);
  const [realizedProfit, setRealizedProfit] = useState<number>(0);
  const [realizedRoiPercent, setRealizedRoiPercent] = useState<number>(0);

  useEffect(() => {
    if (!validOperationId) {
      setLoadingFinance(false);
      return;
    }

    const key = CACHE_KEYS.OP_FINANCIAL(operation.id, roiExpectedPercent);

    const cached = cacheGet<any>(key);
    if (cached) {
      setAmountInvested(Number(cached.amountInvested ?? 0));
      setExpectedProfit(Number(cached.expectedProfit ?? 0));
      setRealizedProfit(Number(cached.realizedProfit ?? 0));
      setRealizedRoiPercent(Number(cached.realizedRoiPercent ?? 0));
      setLoadingFinance(false);
    } else {
      setLoadingFinance(true);
    }

    let alive = true;

    getOrFetch(
      key,
      async () => {
        const res = await api.get(`/operation-financial/${operation.id}`, {
          params: { roi_expected: roiExpectedPercent },
          timeout: 30000,
        });
        return res.data ?? {};
      }
    )
      .then((d) => {
        if (!alive) return;

        setAmountInvested(Number(d.amountInvested ?? 0));
        setExpectedProfit(Number(d.expectedProfit ?? 0));
        setRealizedProfit(Number(d.realizedProfit ?? 0));
        setRealizedRoiPercent(Number(d.realizedRoiPercent ?? 0));
      })
      .catch((err) => {
        console.log(
          "❌ [OperationDetails] erro resumo financeiro",
          err?.response?.status,
          err?.response?.data,
          err?.message ?? err
        );
      })
      .finally(() => {
        if (!alive) return;
        setLoadingFinance(false);
      });

    return () => {
      alive = false;
    };
  }, [validOperationId, operation.id, roiExpectedPercent]);

  /**
   * ✅ Total de custos (IGUAL a tela OperationCosts)
   * - Busca em /operation-costs/:id
   * - Faz parse resiliente do campo total
   */
  const [totalCosts, setTotalCosts] = useState<number>(operation.totalCosts);
  const [loadingCosts, setLoadingCosts] = useState(false);

  useEffect(() => {
    setTotalCosts(operation.totalCosts);
  }, [operation.totalCosts, operation.id]);

  useEffect(() => {
    if (!validOperationId) {
      setLoadingCosts(false);
      return;
    }

    const key = CACHE_KEYS.OP_COSTS(operation.id);

    // 1) prefill instantâneo
    const cached = cacheGet<any>(key);
    if (cached) {
      const cachedTotal = pickTotalCosts(cached);
      if (cachedTotal || cachedTotal === 0) {
        setTotalCosts(cachedTotal);
        setLoadingCosts(false);
      } else {
        setLoadingCosts(true);
      }
    } else {
      setLoadingCosts(true);
    }

    let alive = true;

    getOrFetch(
      key,
      async () => {
        const res = await api.get(`/operation-costs/${operation.id}`, {
          timeout: 30000,
        });
        return res.data ?? {};
      }
    )
      .then((d) => {
        if (!alive) return;

        // ✅ LOG ÚTIL pra você ver o shape real
        console.log("🟦 [OperationDetails] /operation-costs payload =", d);

        const parsed = pickTotalCosts(d);
        setTotalCosts(parsed);
      })
      .catch((err) => {
        console.log(
          "❌ [OperationDetails] erro ao buscar totalCosts",
          err?.response?.status,
          err?.response?.data,
          err?.message ?? err
        );
      })
      .finally(() => {
        if (!alive) return;
        setLoadingCosts(false);
      });

    return () => {
      alive = false;
    };
  }, [validOperationId, operation.id]);

  function goToTimeline() {
    if (!validOperationId) {
      Alert.alert(
        "Operação inválida",
        "O ID da operação chegou inválido. Volte e abra novamente a operação."
      );
      return;
    }
    navigation.navigate("OperationTimeline" as never, {
      id: String(operation.id),
      name: String(operation.name),
      status: statusParam,
    } as never);
  }

  function goToCosts() {
    if (!validOperationId) {
      Alert.alert(
        "Operação inválida",
        "O ID da operação chegou inválido. Volte e abra novamente a operação."
      );
      return;
    }
    navigation.navigate("OperationCosts" as never, {
      id: String(operation.id),
      name: String(operation.name),
    } as never);
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

        {!validOperationId && (
          <View style={styles.warnBox}>
            <Text style={styles.warnTitle}>ID da operação inválido</Text>
            <Text style={styles.warnText}>
              O app recebeu um ID inválido. Por isso, os dados não serão carregados.
            </Text>
            <Text style={styles.warnText}>ID recebido: {String(operation.id)}</Text>
          </View>
        )}

        <View style={styles.header}>
          <Text style={styles.title}>Detalhes da operação</Text>
          <Text style={styles.subtitle}>
            Acompanhe de perto o andamento da sua operação.
          </Text>
        </View>

        <View style={styles.mainCard}>
          <Text style={styles.propertyName}>{operation.name}</Text>
          <Text style={styles.location}>
            {operation.city} - {operation.state}
          </Text>

          <View style={styles.statusRow}>
            <View
              style={[
                styles.chip,
                statusParam === "concluida"
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
                {loadingFinance ? "Carregando..." : formatCurrency(amountInvested)}
              </Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Lucro esperado</Text>
              <Text style={styles.metricValue}>
                {loadingFinance ? "Carregando..." : formatCurrency(expectedProfit)}
              </Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>ROI % esperado</Text>
              <Text style={styles.metricValue}>{`${roiExpectedPercent.toFixed(1)}%`}</Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Lucro realizado</Text>
              <Text style={styles.metricValue}>
                {loadingFinance
                  ? "Carregando..."
                  : isFinished
                  ? formatCurrency(realizedProfit)
                  : "—"}
              </Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>ROI % realizado</Text>
              <Text style={styles.metricValue}>
                {loadingFinance
                  ? "Carregando..."
                  : isFinished
                  ? `${realizedRoiPercent.toFixed(1)}%`
                  : "—"}
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
              {loadingCosts ? "Carregando..." : formatCurrency(totalCosts)}
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

            <View style={styles.docDivider} />

            <DocRow
              label="Contrato SCP"
              available={!!contratoScpUrl}
              onPress={() => handleOpenDoc(contratoScpUrl, "Contrato SCP")}
            />
          </View>

          {!cartaUrl && !matriculaUrl && !contratoScpUrl && (
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

  warnBox: {
    backgroundColor: "#5b2a2a",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  warnTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 6,
  },
  warnText: { color: "#fff", fontSize: 12, opacity: 0.95 },

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
  costHint: {
    color: "#8AB4FF",
    fontSize: 12,
    marginTop: 8,
    fontWeight: "600",
  },

  docsCard: {
    backgroundColor: "#14395E",
    borderRadius: 12,
    overflow: "hidden",
  },
  docRow: { padding: 14 },
  docRowDisabled: { opacity: 0.6 },
  docLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  docStatus: { color: "#8AB4FF", fontSize: 12, fontWeight: "600" },
  docDivider: { height: 1, backgroundColor: "#1F4C78" },
  docsEmptyHint: { color: "#C3C9D6", fontSize: 12, marginTop: 8 },
});
