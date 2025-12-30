import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppStackParamList } from "../navigation/types";
import Screen from "./Screen";
import TriadeLoading from "../ui/TriadeLoading";

import { api } from "../services/api";
import { lastLoginStorage } from "../storage/lastLoginStorage";

import { cacheGet, getOrFetch } from "../cache/memoryCache";
import { CACHE_KEYS } from "../cache/cacheKeys";

type Operation = {
  id: string | number;
  status?: string;
  amountInvested?: number;
  totalInvestment?: number;
  realizedProfit?: number;
  netProfit?: number;
  roi?: number;
};

type OperationFinancial = {
  amountInvested: number;
  expectedProfit: number;
  realizedProfit: number;
  realizedRoiPercent: number;
  roiExpectedPercent: number;
};

type NotificationItem = {
  id: string;
  dateTimeRaw: string | null;
  codigoImovel: string;
  title: string;
  shortMessage: string;
  detailedMessage?: string | null;
  type?: string | null;
};

type Props = NativeStackScreenProps<AppStackParamList, "Home"> & {
  onLogout: () => Promise<void>;
};

function firstNameFromFullName(fullName?: string) {
  const s = String(fullName ?? "").trim();
  if (!s) return "";
  return s.split(/\s+/)[0] ?? "";
}

function roiToPercent(roi: any) {
  const r = Number(roi ?? 0);
  return r < 1 ? r * 100 : r;
}

function capitalizeFirstName(name?: string) {
  const s = String(name ?? "").trim();
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function buildFinancialFromApi(d: any, fallbackRoiExpectedPercent: number): OperationFinancial {
  return {
    amountInvested: Number(d?.amountInvested ?? 0),
    expectedProfit: Number(d?.expectedProfit ?? 0),
    realizedProfit: Number(d?.realizedProfit ?? 0),
    realizedRoiPercent: Number(d?.realizedRoiPercent ?? 0),
    roiExpectedPercent: Number(d?.roiExpectedPercent ?? fallbackRoiExpectedPercent ?? 0),
  };
}

export function HomeScreen({ navigation, onLogout }: Props) {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(true);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);

  const [firstName, setFirstName] = useState<string>("");

  const [financialById, setFinancialById] = useState<Record<string, OperationFinancial | undefined>>(
    {}
  );
  const [loadingFinancial, setLoadingFinancial] = useState(false);

  /**
   * 1) /me (cache em memória, não trava a tela)
   */
  useEffect(() => {
    let alive = true;

    async function loadMe() {
      try {
        // ✅ 1) prefill instantâneo do cache
        const cached = cacheGet<any>(CACHE_KEYS.ME);
        if (cached) {
          const party = cached.party ?? {};
          const fn =
            String(party.firstName ?? cached.firstName ?? "").trim() ||
            firstNameFromFullName(String(party.name ?? cached.fullName ?? "").trim());

          if (alive) setFirstName(fn);
        }

        // ✅ 2) atualiza em background (cache ou servidor)
        const d = await getOrFetch(CACHE_KEYS.ME, async () => {
          const res = await api.get("/me", { timeout: 15000 });
          return res.data ?? {};
        });

        if (!alive) return;

        const party = d.party ?? {};
        const fn =
          String(party.firstName ?? d.firstName ?? "").trim() ||
          firstNameFromFullName(String(party.name ?? d.fullName ?? "").trim());

        setFirstName(fn);
      } catch (err: any) {
        console.log(
          "❌ [HomeScreen] erro /me:",
          err?.response?.status,
          err?.response?.data,
          err?.message ?? err
        );
        if (!alive) return;
        setFirstName("");
      }
    }

    loadMe();
    return () => {
      alive = false;
    };
  }, []);

  /**
   * 2) /operations (cache em memória)
   */
  useEffect(() => {
    let alive = true;

    async function loadOperations() {
      try {
        // ✅ 1) prefill do cache
        const cachedOps = cacheGet<Operation[]>(CACHE_KEYS.OPERATIONS);
        if (cachedOps && Array.isArray(cachedOps)) {
          if (!alive) return;
          setOperations(cachedOps);
          setLoading(false);
        } else {
          if (!alive) return;
          setLoading(true);
        }

        // ✅ 2) garante (cache ou servidor)
        const ops = await getOrFetch(CACHE_KEYS.OPERATIONS, async () => {
          const res = await api.get("/operations", { timeout: 30000 });
          const data = (res.data ?? []) as Operation[];
          return Array.isArray(data) ? data : [];
        });

        if (!alive) return;
        setOperations(ops);
      } catch (err: any) {
        console.log("❌ [HomeScreen] /operations error:", err?.message, err?.response?.data);
        if (!alive) return;
        setOperations((prev) => (prev?.length ? prev : []));
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    loadOperations();
    return () => {
      alive = false;
    };
  }, []);

  /**
   * 3) financeiro por operação (background) + cache
   */
  useEffect(() => {
    let alive = true;

    async function loadFinancial() {
      try {
        if (!operations || operations.length === 0) return;

        // ✅ 1) prefill instantâneo do cache (por operação)
        const prefill: Record<string, OperationFinancial | undefined> = {};
        for (const op of operations) {
          const id = String(op.id).trim();
          if (!id) continue;

          const roiExpectedPercent = roiToPercent(op.roi);
          const key = CACHE_KEYS.OP_FINANCIAL(id, roiExpectedPercent);
          const cached = cacheGet<any>(key);
          if (cached) {
            prefill[id] = buildFinancialFromApi(cached, roiExpectedPercent);
          }
        }

        if (alive && Object.keys(prefill).length > 0) {
          setFinancialById((prev) => ({ ...prev, ...prefill }));
        }

        // ✅ 2) atualiza em background
        if (!alive) return;
        setLoadingFinancial(true);

        const results: Record<string, OperationFinancial | undefined> = {};
        const limit = 6;
        let idx = 0;

        async function worker() {
          while (idx < operations.length) {
            const op = operations[idx++];
            const id = String(op.id).trim();
            if (!id) continue;

            const roiExpectedPercent = roiToPercent(op.roi);
            const key = CACHE_KEYS.OP_FINANCIAL(id, roiExpectedPercent);

            try {
              const d = await getOrFetch(key, async () => {
                const finRes = await api.get(`/operation-financial/${id}`, {
                  params: { roi_expected: roiExpectedPercent },
                  timeout: 30000,
                });
                return finRes.data ?? {};
              });

              results[id] = buildFinancialFromApi(d, roiExpectedPercent);
            } catch (err: any) {
              console.log(
                "❌ [HomeScreen] erro financeiro",
                id,
                err?.response?.status,
                err?.response?.data,
                err?.message ?? err
              );
              results[id] = undefined;
            }
          }
        }

        await Promise.all(
          Array.from({ length: Math.min(limit, operations.length) }, () => worker())
        );

        if (!alive) return;
        setFinancialById((prev) => ({ ...prev, ...results }));
      } finally {
        if (!alive) return;
        setLoadingFinancial(false);
      }
    }

    loadFinancial();
    return () => {
      alive = false;
    };
  }, [operations]);

  /**
   * 4) Notificações (cache por CPF)
   */
  useEffect(() => {
    let alive = true;

    async function loadNotifs() {
      try {
        if (!alive) return;
        setLoadingNotifs(true);

        const cpf = await lastLoginStorage.getCpf();
        if (!cpf) {
          if (!alive) return;
          setNotifications([]);
          return;
        }

        const key = CACHE_KEYS.NOTIFICATIONS(cpf);

        // ✅ prefill instantâneo
        const cached = cacheGet<NotificationItem[]>(key);
        if (cached && Array.isArray(cached)) {
          if (!alive) return;
          setNotifications(cached);
          setLoadingNotifs(false);
        }

        // ✅ revalida
        const data = await getOrFetch(key, async () => {
          const res = await api.get(`/notifications?cpf=${encodeURIComponent(cpf)}`, {
            timeout: 30000,
          });
          return (res.data ?? []) as NotificationItem[];
        });

        if (!alive) return;
        setNotifications(Array.isArray(data) ? data : []);
      } catch {
        if (!alive) return;
        setNotifications((prev) => (prev?.length ? prev : []));
      } finally {
        if (!alive) return;
        setLoadingNotifs(false);
      }
    }

    loadNotifs();
    return () => {
      alive = false;
    };
  }, []);

  const totalOperations = operations.length;
  const activeOperations = operations.filter((op) => op.status === "em_andamento").length;
  const finishedOperations = totalOperations - activeOperations;

  const summary = useMemo(() => {
    return getSummaryFromOperations(operations, financialById);
  }, [operations, financialById]);

  const latestNotifs = (notifications ?? []).slice(0, 1);

  const greetingName = firstName ? capitalizeFirstName(firstName) : "investidor";

  if (loading && operations.length === 0) return <TriadeLoading />;

  return (
    <Screen title="Home" onLogout={onLogout} padding={16} contentTopOffset={0}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Olá, {greetingName}</Text>
        <Text style={styles.subtitle}>Acompanhe a evolução dos seus investimentos.</Text>
        {loadingFinancial && (
          <Text style={styles.helperText}>Atualizando valores financeiros...</Text>
        )}
      </View>

      {/* ✅ Linha com 2 cards (metade do tamanho cada) */}
      <View style={styles.metricsRow}>
        <MetricCard
          label="Total dos investimentos"
          value={formatCurrency(summary.totalInvestedActive)}
        />

        <TouchableOpacity
          style={[styles.metricCard, styles.statementCard]}
          activeOpacity={0.85}
          onPress={() => navigation.navigate("Statement" as never)}
        >
          <Text style={styles.metricLabel}>Extrato</Text>
          <Text style={styles.statementValue}>Ver extrato →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Resumo das operações</Text>

        <TouchableOpacity
          style={styles.operationsCard}
          onPress={() => navigation.navigate("Operations")}
          activeOpacity={0.8}
        >
          <Text style={styles.operationsTitle}>
            Você possui {totalOperations} operação{totalOperations !== 1 ? "es" : ""}
          </Text>

          <Text style={styles.operationsSubtitle}>
            {activeOperations} em andamento • {finishedOperations} concluída
            {finishedOperations !== 1 ? "s" : ""}
          </Text>

          <Text style={styles.operationsLinkText}>Ver detalhes das operações →</Text>
        </TouchableOpacity>
      </View>

      {/* Lucro realizado + ROI médio: somente concluídas */}
      <View style={styles.section}>
        <View style={styles.metricsRow}>
          <MetricCard label="Lucro realizado" value={formatCurrency(summary.totalRealizedProfit)} />
          <MetricCard label="ROI médio realizado" value={summary.averageRoi.toFixed(1) + "%"} />
        </View>
      </View>

      {/* Notificações */}
      <View style={styles.section}>
        <View style={styles.notifHeaderRow}>
          <Text style={styles.sectionTitle}>Últimas notificações</Text>

          <TouchableOpacity onPress={() => navigation.navigate("Notifications")} activeOpacity={0.8}>
            <Text style={styles.notifLink}>Ver todas →</Text>
          </TouchableOpacity>
        </View>

        {loadingNotifs ? (
          <Text style={styles.notifEmpty}>Carregando notificações...</Text>
        ) : latestNotifs.length === 0 ? (
          <Text style={styles.notifEmpty}>Nenhuma notificação recente.</Text>
        ) : (
          latestNotifs.map((n) => (
            <TouchableOpacity
              key={n.id}
              style={styles.notifCard}
              activeOpacity={0.85}
              onPress={() => navigation.navigate("Notifications")}
            >
              <Text style={styles.notifMeta}>
                {n.codigoImovel}
                {n.dateTimeRaw ? ` • ${n.dateTimeRaw}` : ""}
              </Text>

              <Text style={styles.notifShort}>{n.shortMessage}</Text>

              <Text style={styles.notifLong}>
                {n.detailedMessage && n.detailedMessage.trim() !== ""
                  ? n.detailedMessage
                  : "Ainda não disponível."}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </Screen>
  );
}

export default HomeScreen;

function getSummaryFromOperations(
  operations: Operation[],
  financialById: Record<string, OperationFinancial | undefined>
) {
  let investedActive = 0;

  let investedFinished = 0;
  let realizedFinished = 0;

  for (const op of operations) {
    const id = String(op.id);
    const fin = financialById[id];

    const amount = Number(fin?.amountInvested ?? op.amountInvested ?? op.totalInvestment ?? 0);
    const realized = Number(fin?.realizedProfit ?? op.realizedProfit ?? op.netProfit ?? 0);

    if (op.status === "em_andamento") investedActive += amount;

    if (op.status === "concluida") {
      investedFinished += amount;
      realizedFinished += realized;
    }
  }

  const averageRoi = investedFinished > 0 ? (realizedFinished / investedFinished) * 100 : 0;

  return {
    totalInvestedActive: investedActive,
    totalRealizedProfit: realizedFinished,
    averageRoi,
  };
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function formatCurrency(value: number): string {
  const v = Number.isFinite(value) ? value : 0;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const styles = StyleSheet.create({
  header: { marginTop: 12, marginBottom: 16 },
  welcomeText: { fontSize: 22, fontWeight: "600", color: "#FFFFFF" },
  subtitle: { fontSize: 14, color: "#D0D7E3" },
  helperText: { marginTop: 6, fontSize: 12, color: "#C3C9D6" },

  metricsRow: { flexDirection: "row", gap: 12, marginBottom: 12 },

  metricCard: { flex: 1, backgroundColor: "#14395E", borderRadius: 12, padding: 12 },
  metricLabel: { color: "#C3C9D6", fontSize: 12 },
  metricValue: { color: "#FFFFFF", fontSize: 16, fontWeight: "600", marginTop: 4 },

  // ✅ Extrato card (metade) - estilo “link”
  statementCard: { justifyContent: "center" },
  statementValue: { color: "#8AB4FF", fontSize: 14, fontWeight: "700", marginTop: 6 },

  section: { marginTop: 20 },
  sectionTitle: { fontSize: 18, color: "#FFFFFF", marginBottom: 8, fontWeight: "600" },

  operationsCard: { backgroundColor: "#14395E", borderRadius: 12, padding: 16 },
  operationsTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "600", marginBottom: 4 },
  operationsSubtitle: { color: "#C5D2E0", fontSize: 13, marginBottom: 10 },
  operationsLinkText: { color: "#8AB4FF", fontSize: 13, fontWeight: "500" },

  notifHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  notifLink: { color: "#8AB4FF", fontSize: 13, fontWeight: "600" },
  notifEmpty: { color: "#C3C9D6", fontSize: 13 },

  notifCard: { backgroundColor: "#14395E", borderRadius: 12, padding: 12 },
  notifMeta: { color: "#C3C9D6", fontSize: 11, marginBottom: 6 },
  notifShort: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", marginBottom: 6 },
  notifLong: { color: "#E2E6F0", fontSize: 12, lineHeight: 18 },
});
