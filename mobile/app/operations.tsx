// mobile/app/operations.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { Investment } from "../lib/models";
import { API_BASE_URL } from "../lib/config";

const MAIN_BLUE = "#0E2A47";

export default function OperationsScreen() {
  const router = useRouter();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 👉 Abre os detalhes da operação
  function openDetails(investment: Investment) {
    console.log("LOG_OPEN_DETAILS:", investment);

    const roiRaw = investment.roi ?? 0;
    const roiPercent = roiRaw < 1 ? roiRaw * 100 : roiRaw;
    const amountInvestedValue = investment.amountInvested ?? 0;

    const expectedReturnCalc =
      amountInvestedValue && roiPercent
        ? amountInvestedValue * (roiPercent / 100)
        : 0;

    // ✅ NOVO: pega os links que vierem do backend em investment.documents
    // (como o type Investment pode ainda não ter isso, usamos "as any" pra não quebrar)
    const docs = (investment as any)?.documents || {};
    const cartaArrematacao = docs?.cartaArrematacao || "";
    const matriculaConsolidada = docs?.matriculaConsolidada || "";

    const params: [string, string][] = [
      ["id", String(investment.id)],
      ["name", String(investment.propertyName ?? "")],
      ["city", String(investment.city ?? "")],
      ["state", String(investment.state ?? "")],
      ["status", String(investment.status ?? "")],
      ["amountInvested", String(amountInvestedValue)],
      ["roi", String(roiRaw)], // mandamos o valor bruto, detalhe recalcula
      ["expectedReturn", String(expectedReturnCalc)],
      ["realizedProfit", String(investment.realizedProfit ?? 0)],
      ["totalCosts", String(investment.totalCosts ?? 0)],
      ["estimatedTerm", String(investment.estimatedTerm ?? "")],
      ["realizedTerm", String(investment.realizedTerm ?? "")],

      // ✅ NOVO: links de documentos (vem da planilha)
      ["cartaArrematacao", String(cartaArrematacao)],
      ["matriculaConsolidada", String(matriculaConsolidada)],
    ];

    const query = params
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");

    router.push(`/operation-details?${query}`);
  }

  // 🔄 Carrega operações do backend
  useEffect(() => {
    async function loadOperations() {
      try {
        setErrorMsg(null);
        console.log("➡️ Buscando operações em:", `${API_BASE_URL}/operations`);

        const res = await fetch(`${API_BASE_URL}/operations`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = (await res.json()) as Investment[];

        console.log("LOG_BACKEND_OPERATIONS:", data);

        setInvestments(data);
      } catch (error: any) {
        console.error("❌ Erro ao carregar operações da API:", error);
        setErrorMsg("Não foi possível carregar as operações do servidor.");
      } finally {
        setLoading(false);
      }
    }

    loadOperations();
  }, []);

  const activeInvestments = investments.filter(
    (inv) => inv.status === "em_andamento"
  );
  const finishedInvestments = investments.filter(
    (inv) => inv.status === "concluida"
  );

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Minhas operações</Text>
        <Text style={styles.subtitle}>
          Aqui você vê o detalhe de cada operação que investiu.
        </Text>

        {loading && (
          <Text style={styles.loadingText}>Carregando operações...</Text>
        )}

        {!loading && errorMsg && (
          <Text style={styles.errorText}>{errorMsg}</Text>
        )}

        {!loading &&
          !errorMsg &&
          activeInvestments.length === 0 &&
          finishedInvestments.length === 0 && (
            <Text style={styles.emptyText}>
              Você ainda não possui operações cadastradas.
            </Text>
          )}

        {/* Operações em andamento */}
        {activeInvestments.length > 0 && !errorMsg && (
          <>
            <Text style={styles.sectionTitle}>Operações em andamento</Text>
            <FlatList
              data={activeInvestments}
              keyExtractor={(item) => String(item.id)}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => openDetails(item)}>
                  <InvestmentCard investment={item} />
                </TouchableOpacity>
              )}
            />
          </>
        )}

        {/* Operações finalizadas */}
        {finishedInvestments.length > 0 && !errorMsg && (
          <>
            <Text style={[styles.sectionTitle, styles.finishedSectionTitle]}>
              Operações finalizadas
            </Text>
            <FlatList
              data={finishedInvestments}
              keyExtractor={(item) => String(item.id)}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => openDetails(item)}>
                  <InvestmentCard investment={item} />
                </TouchableOpacity>
              )}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// 👉 Card de cada operação na lista
function InvestmentCard({ investment }: { investment: Investment }) {
  const isActive = investment.status === "em_andamento";

  // ROI esperado (da planilha/backend)
  const roiRaw = investment.roi ?? 0;
  const roiPercentExpected = roiRaw < 1 ? roiRaw * 100 : roiRaw;

  // ROI realizado = lucro realizado / valor investido
  const amount = investment.amountInvested || 0;
  const lucroRealizado = investment.realizedProfit || 0;
  const roiRealized =
    !isActive && amount > 0 ? (lucroRealizado / amount) * 100 : 0;

  // Label e valor que vamos exibir
  const roiLabel = isActive ? "ROI esperado" : "ROI realizado";
  const roiDisplay = isActive ? roiPercentExpected : roiRealized;

  const expectedReturnCalc =
    (investment.amountInvested || 0) * (roiPercentExpected / 100);

  return (
    <View style={styles.investmentCard}>
      <View style={styles.investmentHeader}>
        <Text style={styles.investmentTitle}>{investment.propertyName}</Text>

        <View
          style={[
            styles.statusBadge,
            isActive ? styles.statusActive : styles.statusFinished,
          ]}
        >
          <Text style={styles.statusText}>
            {isActive ? "Em andamento" : "Concluída"}
          </Text>
        </View>
      </View>

      <Text style={styles.investmentLocation}>
        {investment.city} - {investment.state}
      </Text>

      <View style={styles.investmentRow}>
        <View style={styles.investmentColumn}>
          <Text style={styles.investmentLabel}>Valor investido</Text>
          <Text style={styles.investmentValue}>
            {formatCurrency(investment.amountInvested)}
          </Text>
        </View>

        <View style={styles.investmentColumn}>
          <Text style={styles.investmentLabel}>
            {isActive ? "Lucro esperado" : "Lucro realizado"}
          </Text>
          <Text style={styles.investmentValue}>
            {isActive
              ? formatCurrency(expectedReturnCalc)
              : formatCurrency(investment.realizedProfit || 0)}
          </Text>
        </View>

        <View style={styles.investmentColumn}>
          <Text style={styles.investmentLabel}>{roiLabel}</Text>
          <Text style={styles.investmentValue}>{roiDisplay.toFixed(1)}%</Text>
        </View>
      </View>
    </View>
  );
}

function formatCurrency(value: number | undefined): string {
  const v = value ?? 0;
  return v.toLocaleString("pt-BR", {
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
    paddingBottom: 48,
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
  loadingText: {
    color: "#D0D7E3",
    fontSize: 14,
    marginTop: 12,
  },
  emptyText: {
    color: "#D0D7E3",
    fontSize: 14,
    marginTop: 12,
  },
  errorText: {
    color: "#FFB4B4",
    fontSize: 14,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 12,
  },
  finishedSectionTitle: {
    marginTop: 20,
  },
  separator: {
    height: 12,
  },
  investmentCard: {
    backgroundColor: "#14395E",
    padding: 14,
    borderRadius: 12,
  },
  investmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  investmentTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    marginRight: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusActive: {
    backgroundColor: "#2F80ED44",
  },
  statusFinished: {
    backgroundColor: "#27AE6044",
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 12,
  },
  investmentLocation: {
    color: "#C5D2E0",
    fontSize: 12,
    marginTop: 4,
  },
  investmentRow: {
    flexDirection: "row",
    marginTop: 12,
  },
  investmentColumn: {
    flex: 1,
  },
  investmentLabel: {
    color: "#C3C9D6",
    fontSize: 12,
  },
  investmentValue: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 2,
  },
});
