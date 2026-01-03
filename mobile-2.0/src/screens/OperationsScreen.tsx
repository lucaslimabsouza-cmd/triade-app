import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";

import { AppStackParamList } from "../navigation/types";
import Screen from "./Screen";
import TriadeLoading from "../ui/TriadeLoading";

import { api } from "../services/api";
import { cacheGet, getOrFetch } from "../cache/memoryCache";
import { CACHE_KEYS } from "../cache/cacheKeys";

// ✅ pull-to-refresh (1 linha)
import { useScreenRefresh } from "../refresh/useScreenRefresh";

const MAIN_BLUE = "#0E2A47";

type Operation = {
  id: string | number;
  propertyName?: string;
  name?: string;
  city?: string;
  state?: string;
  status?: "em_andamento" | "concluida" | string;

  // campos antigos (fallback)
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
    contratoScp?: string;
  };
};

type OperationFinancial = {
  amountInvested: number;
  expectedProfit: number;
  realizedProfit: number;
  realizedRoiPercent: number;
  roiExpectedPercent: number;
};

type Props = NativeStackScreenProps<AppStackParamList, "Operations">;

function roiToPercent(roi: any) {
  const r = Number(roi ?? 0);
  return r < 1 ? r * 100 : r;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function OperationsScreen({ navigation }: Props) {
  const [operations, setOperations] = useState<Operation[]>(() => {
    const cachedOps = cacheGet<Operation[]>(CACHE_KEYS.OPERATIONS);
    return cachedOps && Array.isArray(cachedOps) ? cachedOps : [];
  });

  const [loading, setLoading] = useState(() => {
    const cachedOps = cacheGet<Operation[]>(CACHE_KEYS.OPERATIONS);
    return !(cachedOps && Array.isArray(cachedOps) && cachedOps.length > 0);
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ✅ financeiro por operação
  const [financialById, setFinancialById] = useState<Record<string, OperationFinancial | undefined>>(
    {}
  );
  const [loadingFinancialIds, setLoadingFinancialIds] = useState<Record<string, boolean>>({});

  const loadFinancialForOperations = useCallback(
    async (ops: Operation[]) => {
      if (!ops || ops.length === 0) return;

      // marca loading só dos que ainda não tem no state
      const initialLoading: Record<string, boolean> = {};
      ops.forEach((op) => {
        const id = String(op.id);
        if (!financialById[id]) initialLoading[id] = true;
      });

      if (Object.keys(initialLoading).length > 0) {
        setLoadingFinancialIds((prev) => ({ ...prev, ...initialLoading }));
      }

      await Promise.all(
        ops.map(async (op) => {
          const id = String(op.id);

          // se já tem no state, não refaz
          if (financialById[id]) {
            setLoadingFinancialIds((prev) => ({ ...prev, [id]: false }));
            return;
          }

          try {
            const roiExpectedPercent = roiToPercent(op.roi);

            // ✅ alinha a chave com o padrão do Home (evita cache errado por ROI diferente)
            const key = CACHE_KEYS.OP_FINANCIAL(id, roiExpectedPercent);

            const fin = await getOrFetch(key, async () => {
              const res = await api.get(`/operation-financial/${id}`, {
                params: { roi_expected: roiExpectedPercent },
                timeout: 30000,
              });

              const d = res.data ?? {};
              const payload: OperationFinancial = {
                amountInvested: Number(d.amountInvested ?? 0),
                expectedProfit: Number(d.expectedProfit ?? 0),
                realizedProfit: Number(d.realizedProfit ?? 0),
                realizedRoiPercent: Number(d.realizedRoiPercent ?? 0),
                roiExpectedPercent: Number(d.roiExpectedPercent ?? roiExpectedPercent ?? 0),
              };
              return payload;
            });

            setFinancialById((prev) => ({ ...prev, [id]: fin }));
          } catch (err: any) {
            console.log(
              "❌ [OperationsScreen] erro financeiro",
              id,
              err?.response?.status,
              err?.response?.data,
              err?.message ?? err
            );
          } finally {
            setLoadingFinancialIds((prev) => ({ ...prev, [id]: false }));
          }
        })
      );
    },
    [financialById]
  );

  const loadData = useCallback(async () => {
    try {
      setErrorMsg(null);

      // ✅ mostra cache imediato (se tiver)
      const cachedOps = cacheGet<Operation[]>(CACHE_KEYS.OPERATIONS);
      if (cachedOps && cachedOps.length > 0) {
        setOperations(cachedOps);
        setLoading(false);
        // financeiro em background
        loadFinancialForOperations(cachedOps);
      } else {
        if (operations.length === 0) setLoading(true);
      }

      // ✅ garante dados (cache ou servidor)
      const ops = await getOrFetch(CACHE_KEYS.OPERATIONS, async () => {
        const res = await api.get("/operations", { timeout: 30000 });
        const data = (res.data ?? []) as Operation[];
        return Array.isArray(data) ? data : [];
      });

      setOperations(ops);
      await loadFinancialForOperations(ops);

      // ✅ deixa o refresh “visível” (igual Home)
      await wait(250);
    } catch (err: any) {
      console.log("❌ [OperationsScreen] load error:", err?.message, err?.response?.data);
      setOperations([]);
      setErrorMsg("Não foi possível carregar as operações do servidor.");
    } finally {
      setLoading(false);
    }
  }, [loadFinancialForOperations, operations.length, operations]);

  // ✅ 1 linha: ativa pull-to-refresh
  useScreenRefresh(loadData);

  // ✅ carrega ao entrar/voltar
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const { activeOps, finishedOps } = useMemo(() => {
    const active = operations.filter((op) => op.status === "em_andamento");
    const finished = operations.filter((op) => op.status === "concluida");
    return { activeOps: active, finishedOps: finished };
  }, [operations]);

  function openDetails(op: Operation) {
    const roiRaw = Number(op.roi ?? 0);
    const roiPercentExpected = roiRaw < 1 ? roiRaw * 100 : roiRaw;

    const docs = op.documents ?? {};
    const cartaArrematacao = docs.cartaArrematacao ?? "";
    const matriculaConsolidada = docs.matriculaConsolidada ?? "";

    const id = String(op.id);
    const fin = financialById[id];

    navigation.navigate("OperationDetails", {
      id,
      name: String(op.propertyName ?? op.name ?? ""),
      city: String(op.city ?? ""),
      state: String(op.state ?? ""),
      status: String(op.status ?? ""),
      roi: String(roiRaw),

      amountInvested: String(fin?.amountInvested ?? op.amountInvested ?? op.totalInvestment ?? 0),
      expectedProfit: String(fin?.expectedProfit ?? 0),
      realizedProfit: String(fin?.realizedProfit ?? op.realizedProfit ?? op.netProfit ?? 0),
      realizedRoiPercent: String(fin?.realizedRoiPercent ?? 0),

      totalCosts: String(op.totalCosts ?? 0),
      estimatedTerm: String(op.estimatedTerm ?? ""),
      realizedTerm: String(op.realizedTerm ?? ""),

      cartaArrematacao: String(cartaArrematacao),
      matriculaConsolidada: String(matriculaConsolidada),
      contratoScp: docs.contratoScp ?? "",
      roiExpectedPercent: String(roiPercentExpected),
    } as any);
  }

  if (loading) {
    return (
      <Screen title="" padding={16} contentTopOffset={0}>
        <View style={{ flex: 1, backgroundColor: MAIN_BLUE }}>
          <TriadeLoading />
        </View>
      </Screen>
    );
  }

  const hasNone = !errorMsg && activeOps.length === 0 && finishedOps.length === 0;

  return (
    <Screen title="" padding={16} contentTopOffset={0}>
      <Text style={styles.title}>Minhas operações</Text>
      <Text style={styles.subtitle}>Aqui você vê o detalhe de cada operação que investiu.</Text>

      {!!errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

      {hasNone && (
        <Text style={styles.emptyText}>Você ainda não possui operações cadastradas.</Text>
      )}

      {activeOps.length > 0 && !errorMsg && (
        <>
          <Text style={styles.sectionTitle}>Operações em andamento</Text>
          <FlatList
            data={activeOps}
            keyExtractor={(item) => String(item.id)}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => {
              const id = String(item.id);
              return (
                <TouchableOpacity onPress={() => openDetails(item)} activeOpacity={0.85}>
                  <OperationCard
                    operation={item}
                    financial={financialById[id]}
                    loadingFinancial={!!loadingFinancialIds[id]}
                  />
                </TouchableOpacity>
              );
            }}
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
            renderItem={({ item }) => {
              const id = String(item.id);
              return (
                <TouchableOpacity onPress={() => openDetails(item)} activeOpacity={0.85}>
                  <OperationCard
                    operation={item}
                    financial={financialById[id]}
                    loadingFinancial={!!loadingFinancialIds[id]}
                  />
                </TouchableOpacity>
              );
            }}
          />
        </>
      )}
    </Screen>
  );
}

export default OperationsScreen;

function OperationCard({
  operation,
  financial,
  loadingFinancial,
}: {
  operation: Operation;
  financial?: OperationFinancial;
  loadingFinancial?: boolean;
}) {
  const isActive = operation.status === "em_andamento";

  const roiRaw = Number(operation.roi ?? 0);
  const roiPercentExpected = roiRaw < 1 ? roiRaw * 100 : roiRaw;

  const amount =
    Number(financial?.amountInvested) ||
    Number(operation.amountInvested ?? operation.totalInvestment ?? 0);

  const expectedProfit =
    Number(financial?.expectedProfit) ||
    (amount > 0 ? amount * (roiPercentExpected / 100) : 0);

  const realizedProfit =
    Number(financial?.realizedProfit) ||
    Number(operation.realizedProfit ?? operation.netProfit ?? 0);

  const roiRealized =
    Number(financial?.realizedRoiPercent) ||
    (!isActive && amount > 0 ? (realizedProfit / amount) * 100 : 0);

  const roiLabel = isActive ? "ROI esperado" : "ROI realizado";
  const roiDisplay = isActive ? roiPercentExpected : roiRealized;

  return (
    <View style={styles.investmentCard}>
      <View style={styles.investmentHeader}>
        <Text style={styles.investmentTitle}>
          {operation.propertyName ?? operation.name ?? "Operação"}
        </Text>

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
          <Text style={styles.investmentValue}>
            {loadingFinancial ? "Carregando..." : formatCurrency(amount)}
          </Text>
        </View>

        <View style={styles.investmentColumn}>
          <Text style={styles.investmentLabel}>
            {isActive ? "Lucro esperado" : "Lucro realizado"}
          </Text>
          <Text style={styles.investmentValue}>
            {loadingFinancial
              ? "Carregando..."
              : isActive
              ? formatCurrency(expectedProfit)
              : formatCurrency(realizedProfit)}
          </Text>
        </View>

        <View style={styles.investmentColumn}>
          <Text style={styles.investmentLabel}>{roiLabel}</Text>
          <Text style={styles.investmentValue}>
            {loadingFinancial ? "…" : `${Number(roiDisplay || 0).toFixed(1)}%`}
          </Text>
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
