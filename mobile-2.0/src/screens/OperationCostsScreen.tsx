// src/screens/OperationCostsScreen.tsx

import React, { useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppStackParamList } from "../navigation/types";
import { api } from "../services/api";

import { cacheGet, getOrFetch } from "../cache/memoryCache";
import { CACHE_KEYS } from "../cache/cacheKeys";

const MAIN_BLUE = "#0E2A47";

type CategoryItem = {
  partyCode: string;
  partyName: string;
  total: number;
};

type CategorySummary = {
  categoryCode: string;
  categoryName?: string;
  categoryDescription?: string;
  total: number;
  items?: CategoryItem[];
};

type OperationCostsApiResponse = {
  totalCosts: number;
  excludedTotal?: number;
  categories: CategorySummary[];
};

type Props = NativeStackScreenProps<AppStackParamList, "OperationCosts">;

export function OperationCostsScreen({ navigation, route }: Props) {
  const params = route.params;

  const id = params.id ?? "";
  const name = params.name ?? "Operação";
  const initialTotal = Number(params.totalCosts ?? 0);

  const [totalCosts, setTotalCosts] = useState<number>(initialTotal);
  const [excludedTotal, setExcludedTotal] = useState<number | null>(null);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [openCategoryCode, setOpenCategoryCode] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function fetchCostsFromApi(safeId: string) {
      console.log("➡️ [OperationCosts] GET /operation-costs/:operationId", safeId);

      let res;
      try {
        res = await api.get(`/operation-costs/${encodeURIComponent(safeId)}`);
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 404) {
          console.log(
            "⚠️ [OperationCosts] 404 na rota nova. Tentando rota antiga /operations/:id/costs"
          );
          res = await api.get(`/operations/${encodeURIComponent(safeId)}/costs`);
        } else {
          throw e;
        }
      }

      return (res?.data ?? {}) as OperationCostsApiResponse;
    }

    async function loadCosts() {
      const rawId = String(id ?? "");
      const safeId = rawId.replace(/--+/g, "-").trim(); // ✅ FIX2: remove hífens duplicados

      if (!safeId) {
        if (!alive) return;
        setLoading(false);
        setErrorMsg("Operação inválida.");
        return;
      }

      console.log("🧩 [OperationCosts] rawId =", rawId);
      console.log("🧩 [OperationCosts] safeId =", safeId);

      const cacheKey = CACHE_KEYS.OP_COSTS(safeId);

      try {
        if (!alive) return;
        setErrorMsg(null);

        // ✅ 1) preenche instantâneo do cache (sem spinner se tiver)
        const cached = cacheGet<OperationCostsApiResponse>(cacheKey);
        if (cached) {
          if (!alive) return;

          setTotalCosts(
            typeof cached.totalCosts === "number" ? cached.totalCosts : initialTotal
          );
          setExcludedTotal(
            typeof cached.excludedTotal === "number" ? cached.excludedTotal : null
          );
          setCategories(Array.isArray(cached.categories) ? cached.categories : []);
          setOpenCategoryCode(null);

          setLoading(false);
        } else {
          setLoading(true);
        }

        // ✅ 2) garante dados (cache ou servidor) e atualiza
        const data = await getOrFetch(cacheKey, async () => {
          return await fetchCostsFromApi(safeId);
        });

        if (!alive) return;

        setTotalCosts(typeof data.totalCosts === "number" ? data.totalCosts : initialTotal);
        setExcludedTotal(typeof data.excludedTotal === "number" ? data.excludedTotal : null);
        setCategories(Array.isArray(data.categories) ? data.categories : []);
        setOpenCategoryCode(null);
      } catch (err: any) {
        console.log(
          "❌ [OperationCosts] load error:",
          err?.message,
          err?.response?.status,
          err?.response?.data
        );
        if (!alive) return;
        setErrorMsg("Não foi possível carregar os custos detalhados.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    loadCosts();

    return () => {
      alive = false;
    };
  }, [id, initialTotal]);

  const sortedCategories = useMemo(() => {
    const list = [...(categories ?? [])];
    list.sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0));
    return list;
  }, [categories]);

  const hasCategories = sortedCategories.length > 0;

  const toggleCategory = (code: string) => {
    setOpenCategoryCode((prev) => (prev === code ? null : code));
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
            style={styles.backBtn}
          >
            <Text style={styles.backText}>← Voltar</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Custos</Text>
          <View style={{ width: 70 }} />
        </View>

        <Text style={styles.title}>Custos do projeto</Text>
        <Text style={styles.subtitle}>{name}</Text>

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total de custos</Text>
          <Text style={styles.totalValue}>{formatCurrency(totalCosts)}</Text>

          {excludedTotal !== null && excludedTotal > 0 && (
            <View style={styles.totalBreakdown}>
              <Text style={styles.totalBreakdownText}>
                Excluídos (2.10.98 / 2.10.99): {formatCurrency(excludedTotal)}
              </Text>
            </View>
          )}
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.loadingText}>Carregando custos por categoria...</Text>
          </View>
        )}

        {!loading && errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

        {!loading && !errorMsg && !hasCategories && (
          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderText}>
              Ainda não há custos detalhados lançados para esta operação.
              {"\n"}
              Assim que os lançamentos estiverem integrados com o Omie,
              você verá aqui o total de cada categoria de custo.
            </Text>
          </View>
        )}

        {!loading && !errorMsg && hasCategories && (
          <View style={styles.breakdownContainer}>
            {sortedCategories.map((cat) => {
              const label =
                cat.categoryName?.trim()
                  ? cat.categoryName
                  : cat.categoryDescription?.trim()
                  ? cat.categoryDescription
                  : cat.categoryCode;

              const isOpen = openCategoryCode === cat.categoryCode;
              const items = Array.isArray(cat.items) ? cat.items : [];

              return (
                <View key={cat.categoryCode} style={styles.categoryCard}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => toggleCategory(cat.categoryCode)}
                    style={styles.categoryHeader}
                  >
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.categoryTitle} numberOfLines={2}>
                        {label}
                      </Text>
                      <Text style={styles.categorySubtitle}>
                        {isOpen ? "Toque para recolher" : "Toque para ver fornecedores"}
                      </Text>
                    </View>

                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.categoryTotal}>
                        {formatCurrency(Number(cat.total) || 0)}
                      </Text>
                      <Text style={styles.chevron}>{isOpen ? "▲" : "▼"}</Text>
                    </View>
                  </TouchableOpacity>

                  {isOpen && (
                    <View style={styles.itemsContainer}>
                      {items.length === 0 ? (
                        <Text style={styles.itemEmptyText}>
                          Nenhum fornecedor identificado nesses lançamentos.
                        </Text>
                      ) : (
                        items
                          .slice()
                          .sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0))
                          .map((it) => (
                            <View
                              key={`${cat.categoryCode}-${it.partyCode}`}
                              style={styles.itemRow}
                            >
                              <Text style={styles.itemName} numberOfLines={1}>
                                {it.partyName}
                              </Text>
                              <Text style={styles.itemValue}>
                                {formatCurrency(Number(it.total) || 0)}
                              </Text>
                            </View>
                          ))
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default OperationCostsScreen;

function formatCurrency(value: number): string {
  const v = Number.isFinite(value) ? value : 0;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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

  title: { fontSize: 22, color: "#FFFFFF", fontWeight: "600" },
  subtitle: { fontSize: 14, color: "#D0D7E3", marginTop: 4, marginBottom: 16 },

  totalCard: {
    backgroundColor: "#14395E",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  totalLabel: { fontSize: 12, color: "#C3C9D6" },
  totalValue: { fontSize: 18, color: "#FFFFFF", fontWeight: "600", marginTop: 4 },
  totalBreakdown: { marginTop: 6 },
  totalBreakdownText: { fontSize: 12, color: "#C3C9D6" },

  loadingContainer: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  loadingText: { color: "#D0D7E3", fontSize: 14, marginLeft: 8 },

  errorText: { color: "#FFB4B4", fontSize: 14, marginBottom: 12 },

  placeholderCard: { backgroundColor: "#14395E", borderRadius: 12, padding: 14 },
  placeholderText: { fontSize: 13, color: "#D0D7E3", lineHeight: 20 },

  breakdownContainer: { marginTop: 6 },

  categoryCard: {
    backgroundColor: "#14395E",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  categoryTitle: { fontSize: 14, color: "#FFFFFF", fontWeight: "700" },
  categorySubtitle: { fontSize: 12, color: "#C3C9D6", marginTop: 4 },
  categoryTotal: { fontSize: 14, color: "#FFFFFF", fontWeight: "700" },
  chevron: { color: "#C3C9D6", marginTop: 6, textAlign: "right" },

  itemsContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.10)",
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  itemName: { flex: 1, marginRight: 10, color: "#FFFFFF", fontSize: 13 },
  itemValue: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  itemEmptyText: { color: "#C3C9D6", fontSize: 13 },
});
