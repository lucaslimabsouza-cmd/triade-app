// src/screens/OperationDetailsScreen.tsx

import React, { useMemo, useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";

import { AppStackParamList } from "../navigation/types";
import Screen from "./Screen";
import { api } from "../services/api";

import { cacheGet, getOrFetch } from "../cache/memoryCache";
import { CACHE_KEYS } from "../cache/cacheKeys";

// ✅ pull-to-refresh (1 linha)
import { useScreenRefresh } from "../refresh/useScreenRefresh";

const MAIN_BLUE = "#0E2A47";

/* =========================
   Utils
========================= */

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  const financeKey = useMemo(() => {
    return CACHE_KEYS.OP_FINANCIAL(operation.id, roiExpectedPercent);
  }, [operation.id, roiExpectedPercent]);

  const cachedFinanceFirst = useMemo(() => cacheGet<any>(financeKey), [financeKey]);

  const [loadingFinance, setLoadingFinance] = useState(() => !cachedFinanceFirst);
  const [amountInvested, setAmountInvested] = useState<number>(() =>
    Number(cachedFinanceFirst?.amountInvested ?? 0)
  );
  const [expectedProfit, setExpectedProfit] = useState<number>(() =>
    Number(cachedFinanceFirst?.expectedProfit ?? 0)
  );
  const [realizedProfit, setRealizedProfit] = useState<number>(() =>
    Number(cachedFinanceFirst?.realizedProfit ?? 0)
  );
  const [realizedRoiPercent, setRealizedRoiPercent] = useState<number>(() =>
    Number(cachedFinanceFirst?.realizedRoiPercent ?? 0)
  );

  /**
   * ✅ Total de custos (igual OperationCosts)
   */
  const costsKey = useMemo(() => CACHE_KEYS.OP_COSTS(operation.id), [operation.id]);
  const cachedCostsFirst = useMemo(() => cacheGet<any>(costsKey), [costsKey]);

  const [totalCosts, setTotalCosts] = useState<number>(() => {
    if (cachedCostsFirst) {
      const v = pickTotalCosts(cachedCostsFirst);
      return Number.isFinite(v) ? v : Number(operation.totalCosts ?? 0);
    }
    return Number(operation.totalCosts ?? 0);
  });

  const [loadingCosts, setLoadingCosts] = useState(() => !cachedCostsFirst);

  const loadData = useCallback(async () => {
    if (!validOperationId) return;

    try {
      /**
       * 1) Prefill cache imediato (sem “piscar”)
       */
      const cachedFin = cacheGet<any>(financeKey);
      if (cachedFin) {
        setAmountInvested(Number(cachedFin.amountInvested ?? 0));
        setExpectedProfit(Number(cachedFin.expectedProfit ?? 0));
        setRealizedProfit(Number(cachedFin.realizedProfit ?? 0));
        setRealizedRoiPercent(Number(cachedFin.realizedRoiPercent ?? 0));
        setLoadingFinance(false);
      } else {
        setLoadingFinance(true);
      }

      const cachedCost = cacheGet<any>(costsKey);
      if (cachedCost) {
        const parsed = pickTotalCosts(cachedCost);
        setTotalCosts(parsed);
        setLoadingCosts(false);
      } else {
        setLoadingCosts(true);
      }

      /**
       * 2) Busca (cache ou servidor) em paralelo
       */
      const [fin, costs] = await Promise.all([
        getOrFetch(financeKey, async () => {
          const res = await api.get(`/operation-financial/${operation.id}`, {
            params: { roi_expected: roiExpectedPercent },
            timeout: 30000,
          });
          return res.data ?? {};
        }),
        getOrFetch(costsKey, async () => {
          const res = await api.get(`/operation-costs/${operation.id}`, {
            timeout: 30000,
          });
          return res.data ?? {};
        }),
      ]);

      // finance
      setAmountInvested(Number(fin.amountInvested ?? 0));
      setExpectedProfit(Number(fin.expectedProfit ?? 0));
      setRealizedProfit(Number(fin.realizedProfit ?? 0));
      setRealizedRoiPercent(Number(fin.realizedRoiPercent ?? 0));
      setLoadingFinance(false);

      // costs
      setTotalCosts(pickTotalCosts(costs));
      setLoadingCosts(false);

      // ✅ tempinho pro spinner ficar visível (igual Home)
      await wait(250);
    } catch (err: any) {
      console.log(
        "❌ [OperationDetails] loadData error",
        err?.response?.status,
        err?.response?.data,
        err?.message ?? err
      );

      // não trava a tela; só desliga loaders
      setLoadingFinance(false);
      setLoadingCosts(false);
    }
  }, [
    validOperationId,
    financeKey,
    costsKey,
    operation.id,
    roiExpectedPercent,
  ]);

  // ✅ 1 linha: ativa pull-to-refresh
  useScreenRefresh(loadData);

  // ✅ carrega ao entrar/voltar
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  function goToTimeline() {
    if (!validOperationId) {
      Alert.alert(
        "Operação inválida",
        "O ID da operação chegou inválido. Volte e abra novamente a operação."
      );
      return;
    }
    navigation.navigate(
      "OperationTimeline" as never,
      {
        id: String(operation.id),
        name: String(operation.name),
        status: statusParam,
      } as never
    );
  }

  function goToCosts() {
    if (!validOperationId) {
      Alert.alert(
        "Operação inválida",
        "O ID da operação chegou inválido. Volte e abra novamente a operação."
      );
      return;
    }
    navigation.navigate(
      "OperationCosts" as never,
      {
        id: String(operation.id),
        name: String(operation.name),
      } as never
    );
  }

  function handleOpenDoc(url: string | null, label: string) {
    if (!url) {
      Alert.alert("Ainda não disponível", `${label} ainda não está disponível.`);
      return;
    }
    openUrl(url);
  }

  return (
    <Screen title="" padding={16} contentTopOffset={0}>
     

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

        <TouchableOpacity style={styles.costCard} activeOpacity={0.8} onPress={goToCosts}>
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
    </Screen>
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
