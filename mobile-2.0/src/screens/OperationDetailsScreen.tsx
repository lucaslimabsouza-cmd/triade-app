import React, { useMemo, useCallback, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Image,
  RefreshControl,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";

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

// ✅ transforma link do Google Drive em link direto (Image do RN precisa disso)
function toDirectDriveUrl(u?: string | null) {
  const raw = String(u ?? "").trim();
  if (!raw) return null;

  // formatos comuns:
  // https://drive.google.com/file/d/<ID>/view?usp=sharing
  // https://drive.google.com/uc?id=<ID>&export=download
  const m1 = raw.match(/drive\.google\.com\/file\/d\/([^/]+)\//i);
  if (m1?.[1]) return `https://drive.google.com/uc?export=view&id=${m1[1]}`;

  const m2 = raw.match(/[?&]id=([^&]+)/i);
  if (m2?.[1]) return `https://drive.google.com/uc?export=view&id=${m2[1]}`;

  return raw;
}

function isValidUuid(u?: string) {
  if (!u) return false;
  const s = String(u).trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
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

  const operationId = useMemo(() => {
    const raw = String(
      params?.id ?? params?.operation_id ?? params?.operationId ?? params?.uuid ?? ""
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
      matriculaConsolidada: d.matriculaConsolidada ?? params?.matriculaConsolidada ?? "",
      contratoScp: d.contratoScp ?? params?.contratoScp ?? "",
    };
  }, [params]);

  const cartaUrl = normalizeUrl(docs.cartaArrematacao);
  const matriculaUrl = normalizeUrl(docs.matriculaConsolidada);
  const contratoScpUrl = normalizeUrl(docs.contratoScp);

  const estimatedTermLabel =
    params.estimatedTerm && params.estimatedTerm !== "" ? `${params.estimatedTerm} meses` : "—";

  const realizedTermLabel =
    isFinished && params.realizedTerm && params.realizedTerm !== ""
      ? `${params.realizedTerm} meses`
      : "—";

  const roiExpectedPercent = roiToPercent(params.roi);

  // ✅ FOTO: vem do backend como photoUrl e pode ser link do Drive
  const initialPhotoUrl = useMemo(() => {
    const raw =
      params?.photoUrl ??
      params?.photo_url ??
      params?.photoURL ??
      null;

    const normalized = normalizeUrl(raw);
    return toDirectDriveUrl(normalized);
  }, [params]);

  const [photoUrl, setPhotoUrl] = useState<string | null>(initialPhotoUrl);
  const [imageFailed, setImageFailed] = useState(false);

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
   * ✅ Finance
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
   * ✅ Costs
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
      setLoadingFinance(true);
      setLoadingCosts(true);

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

      setAmountInvested(Number(fin.amountInvested ?? 0));
      setExpectedProfit(Number(fin.expectedProfit ?? 0));
      setRealizedProfit(Number(fin.realizedProfit ?? 0));
      setRealizedRoiPercent(Number(fin.realizedRoiPercent ?? 0));

      setTotalCosts(pickTotalCosts(costs));
    } catch (err: any) {
      console.log(
        "❌ [OperationDetails] loadData error",
        err?.response?.status,
        err?.response?.data,
        err?.message ?? err
      );
    } finally {
      setLoadingFinance(false);
      setLoadingCosts(false);
    }
  }, [validOperationId, financeKey, costsKey, operation.id, roiExpectedPercent]);

  // ✅ reload ao entrar na tela
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // ✅ Pull to refresh
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  function goToTimeline() {
    if (!validOperationId) {
      Alert.alert("Operação inválida", "O ID da operação chegou inválido. Volte e abra novamente a operação.");
      return;
    }
    navigation.navigate(
      "OperationTimeline" as never,
      { id: String(operation.id), name: String(operation.name), status: statusParam } as never
    );
  }

  function goToCosts() {
    if (!validOperationId) {
      Alert.alert("Operação inválida", "O ID da operação chegou inválido. Volte e abra novamente a operação.");
      return;
    }
    navigation.navigate("OperationCosts" as never, { id: String(operation.id), name: String(operation.name) } as never);
  }

  function handleOpenDoc(url: string | null, label: string) {
    if (!url) {
      Alert.alert("Ainda não disponível", `${label} ainda não está disponível.`);
      return;
    }
    openUrl(url);
  }

  const showImage = !!photoUrl && !imageFailed;

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
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

        {/* ✅ HERO */}
        <View style={styles.heroWrap}>
          {showImage ? (
            <Image
              source={{ uri: String(photoUrl) }}
              style={styles.heroImage}
              resizeMode="cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Text style={styles.heroPlaceholderText}>Sem foto</Text>
            </View>
          )}

          <View style={styles.heroOverlay} />

          <View style={styles.heroTextArea}>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {operation.name}
            </Text>
            <Text style={styles.heroSub} numberOfLines={1}>
              {operation.city} - {operation.state}
            </Text>
          </View>

          <View style={styles.heroChipWrap}>
            <View
              style={[
                styles.heroChip,
                statusParam === "concluida" ? styles.statusChipFinished : styles.statusChipActive,
              ]}
            >
              <Text style={styles.heroChipText}>{operation.status}</Text>
            </View>
          </View>
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
          <Text style={styles.subtitle}>Acompanhe de perto o andamento da sua operação.</Text>
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
                statusParam === "concluida" ? styles.statusChipFinished : styles.statusChipActive,
              ]}
            >
              <Text style={styles.chipText}>{operation.status}</Text>
            </View>
          </View>

          <View style={styles.termColumn}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>Prazo estimado: {operation.estimatedTerm}</Text>
            </View>

            {isFinished && operation.realizedTerm !== "—" && (
              <View style={[styles.chip, styles.realizedTermChip]}>
                <Text style={styles.chipText}>Prazo realizado: {operation.realizedTerm}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.timelineLink} activeOpacity={0.8} onPress={goToTimeline}>
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
                {loadingFinance ? "Carregando..." : isFinished ? formatCurrency(realizedProfit) : "—"}
              </Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>ROI % realizado</Text>
              <Text style={styles.metricValue}>
                {loadingFinance ? "Carregando..." : isFinished ? `${realizedRoiPercent.toFixed(1)}%` : "—"}
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

        {/* Espaço extra pra garantir scroll */}
        <View style={{ height: 24 }} />
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
        <Text style={styles.docStatus}>{available ? "Abrir documento →" : "Ainda não disponível"}</Text>
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

  // ✅ HERO
  heroWrap: {
    height: 200,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 14,
    backgroundColor: "#14395E",
  },
  heroImage: { width: "100%", height: "100%" },
  heroPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#14395E",
  },
  heroPlaceholderText: { color: "#C3C9D6", fontSize: 12, fontWeight: "800" },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  heroTextArea: { position: "absolute", left: 14, right: 14, bottom: 14 },
  heroTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  heroSub: { color: "rgba(255,255,255,0.85)", marginTop: 4, fontSize: 12, fontWeight: "700" },
  heroChipWrap: { position: "absolute", top: 12, left: 12 },
  heroChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(47, 128, 237, 0.35)" },
  heroChipText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },

  warnBox: { backgroundColor: "#5b2a2a", borderRadius: 12, padding: 12, marginBottom: 12 },
  warnTitle: { color: "#fff", fontSize: 14, fontWeight: "800", marginBottom: 6 },
  warnText: { color: "#fff", fontSize: 12, opacity: 0.95 },

  header: { marginBottom: 16 },
  title: { fontSize: 22, color: "#FFFFFF", fontWeight: "600" },
  subtitle: { fontSize: 14, color: "#D0D7E3", marginTop: 4 },

  mainCard: { backgroundColor: "#14395E", borderRadius: 14, padding: 16, marginBottom: 20 },
  propertyName: { fontSize: 18, color: "#FFFFFF", fontWeight: "600" },
  location: { fontSize: 13, color: "#C5D2E0", marginTop: 4 },

  statusRow: { flexDirection: "row", marginTop: 12 },
  termColumn: { marginTop: 8, alignSelf: "flex-start", gap: 8 },

  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "#1E4A75" },
  statusChipActive: { backgroundColor: "#2F80ED55" },
  statusChipFinished: { backgroundColor: "#27AE6055" },
  realizedTermChip: { backgroundColor: "#27AE6055" },
  chipText: { color: "#FFFFFF", fontSize: 11, fontWeight: "500" },

  timelineLink: { marginTop: 10 },
  timelineLinkText: { color: "#8AB4FF", fontSize: 12, fontWeight: "700" },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, color: "#FFFFFF", fontWeight: "600", marginBottom: 10 },

  metricsRow: { flexDirection: "row", gap: 12, marginBottom: 10 },
  metricCard: { flex: 1, backgroundColor: "#14395E", borderRadius: 12, padding: 12 },
  metricLabel: { fontSize: 12, color: "#C3C9D6" },
  metricValue: { fontSize: 15, color: "#FFFFFF", fontWeight: "600", marginTop: 4 },

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
