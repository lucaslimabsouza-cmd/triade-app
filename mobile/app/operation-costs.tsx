// mobile/app/operation-costs.tsx
import React, { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { API_BASE_URL } from "../lib/config";

const MAIN_BLUE = "#0E2A47";

type CategorySummary = {
  categoryCode: string;
  categoryName?: string;
  categoryDescription?: string;
  total: number;
};

type OperationCostsApiResponse = {
  totalCosts: number;
  totalCostsPlanilha?: number;
  totalCostsOmie?: number;
  categories: CategorySummary[];
};

export default function OperationCostsScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    name?: string;
    totalCosts?: string;
  }>();

  const id = params.id ?? "";
  const name = params.name ?? "Operação";
  const initialTotal = Number(params.totalCosts ?? 0);

  const [totalCosts, setTotalCosts] = useState<number>(initialTotal);
  const [totalFromPlan, setTotalFromPlan] = useState<number | null>(null);
  const [totalFromOmie, setTotalFromOmie] = useState<number | null>(null);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadCosts() {
      if (!id) {
        setLoading(false);
        setErrorMsg("Operação inválida.");
        return;
      }

      try {
        setErrorMsg(null);
        setLoading(true);

        const url = `${API_BASE_URL}/operations/${id}/costs`;
        console.log("➡️ Buscando custos detalhados em:", url);

        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = (await res.json()) as OperationCostsApiResponse;

        console.log("✅ Custos detalhados recebidos (bruto):", data);
        console.log("✅ Categorias recebidas:", data.categories);

        setTotalCosts(
          typeof data.totalCosts === "number" ? data.totalCosts : initialTotal
        );
        setTotalFromPlan(
          typeof data.totalCostsPlanilha === "number"
            ? data.totalCostsPlanilha
            : null
        );
        setTotalFromOmie(
          typeof data.totalCostsOmie === "number"
            ? data.totalCostsOmie
            : null
        );
        setCategories(
          Array.isArray(data.categories) ? data.categories : []
        );
      } catch (err: any) {
        console.error("❌ Erro ao carregar custos detalhados:", err);
        setErrorMsg("Não foi possível carregar os custos detalhados.");
      } finally {
        setLoading(false);
      }
    }

    loadCosts();
  }, [id]);

  const hasCategories = categories.length > 0;

  return (
<SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Custos do projeto</Text>
        <Text style={styles.subtitle}>{name}</Text>

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total de custos</Text>
          <Text style={styles.totalValue}>{formatCurrency(totalCosts)}</Text>

          {(totalFromPlan !== null || totalFromOmie !== null) && (
            <View style={styles.totalBreakdown}>
              {totalFromPlan !== null && (
                <Text style={styles.totalBreakdownText}>
                  Planilha: {formatCurrency(totalFromPlan)}
                </Text>
              )}
              {totalFromOmie !== null && (
                <Text style={styles.totalBreakdownText}>
                  Omie: {formatCurrency(totalFromOmie)}
                </Text>
              )}
            </View>
          )}
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.loadingText}>
              Carregando custos por categoria...
            </Text>
          </View>
        )}

        {!loading && errorMsg && (
          <Text style={styles.errorText}>{errorMsg}</Text>
        )}

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
            {categories.map((cat) => {
              // 👉 Prioridade: categoryName (backend) > categoryDescription (fallback) > código
              const label =
                cat.categoryName && cat.categoryName.trim() !== ""
                  ? cat.categoryName
                  : cat.categoryDescription &&
                    cat.categoryDescription.trim() !== ""
                  ? cat.categoryDescription
                  : cat.categoryCode;

              return (
                <View key={cat.categoryCode} style={styles.categoryBlock}>
                  <View style={styles.categoryHeader}>
                    <Text style={styles.categoryTitle}>{label}</Text>
                    <Text style={styles.categoryTotal}>
                      {formatCurrency(cat.total)}
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

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MAIN_BLUE,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
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
    marginBottom: 16,
  },
  totalCard: {
    backgroundColor: "#14395E",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 12,
    color: "#C3C9D6",
  },
  totalValue: {
    fontSize: 18,
    color: "#FFFFFF",
    fontWeight: "600",
    marginTop: 4,
  },
  totalBreakdown: {
    marginTop: 6,
  },
  totalBreakdownText: {
    fontSize: 12,
    color: "#C3C9D6",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  loadingText: {
    color: "#D0D7E3",
    fontSize: 14,
    marginLeft: 8,
  },
  errorText: {
    color: "#FFB4B4",
    fontSize: 14,
    marginBottom: 12,
  },
  placeholderCard: {
    backgroundColor: "#14395E",
    borderRadius: 12,
    padding: 14,
  },
  placeholderText: {
    fontSize: 13,
    color: "#D0D7E3",
    lineHeight: 20,
  },
  breakdownContainer: {
    marginTop: 16,
  },
  categoryBlock: {
    backgroundColor: "#14395E",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryTitle: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  categoryTotal: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
