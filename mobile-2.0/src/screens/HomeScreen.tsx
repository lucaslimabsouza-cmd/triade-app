import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Animated,
  Easing,
  Linking,
  Platform,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

import { useFocusEffect } from "@react-navigation/native";

import { AppStackParamList } from "../navigation/types";
import Screen from "./Screen";

import TriadeLoading from "../ui/TriadeLoading";

import { api } from "../services/api";

import { cacheGet, getOrFetch } from "../cache/memoryCache";
import { CACHE_KEYS } from "../cache/cacheKeys";

const MAIN_BLUE = "#0E2A47";

// Paleta Triade
const TRI = {
  card: "#14395E",
  card2: "#173F66",
  text: "#FFFFFF",
  sub: "#D0D7E3",
  muted: "#C3C9D6",
  link: "#8AB4FF",
  line: "#1F4C78",
  green: "#27AE60", // realizado
  blue: "#8AB4FF", // esperado
  red: "#EB5757",
};

type Operation = {
  id: string | number;
  status?: "em_andamento" | "concluida" | string;
  amountInvested?: number;
  totalInvestment?: number;
  realizedProfit?: number;
  netProfit?: number;
  roi?: number; // esperado
};

type OperationFinancial = {
  amountInvested: number;
  expectedProfit: number;
  realizedProfit: number;
  realizedRoiPercent: number;
  roiExpectedPercent: number;
};

// ✅ alinhado com retorno do backend
type NotificationItem = {
  id: number;
  datahora?: string | null;
  codigo_imovel?: string | null;
  mensagem_curta?: string | null;
  mensagem_detalhada?: string | null;
  tipo?: string | null;
};

// Ordena notificações por datahora (mais recente primeiro)
function sortNotificationsByDate(notifications: NotificationItem[]): NotificationItem[] {
  return [...notifications].sort((a, b) => {
    const dateA = a.datahora ? new Date(a.datahora).getTime() : 0;
    const dateB = b.datahora ? new Date(b.datahora).getTime() : 0;
    return dateB - dateA; // Ordem decrescente (mais recente primeiro)
  });
}

type Props = NativeStackScreenProps<AppStackParamList, "Home"> & {
  onLogout: () => Promise<void>;
};

function firstNameFromFullName(fullName?: string) {
  const s = String(fullName ?? "").trim();
  if (!s) return "";
  return s.split(/\s+/)[0] ?? "";
}

function capitalizeFirstName(name?: string) {
  const s = String(name ?? "").trim();
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function roiToPercent(roi: any) {
  const r = Number(roi ?? 0);
  return r < 1 ? r * 100 : r;
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

function formatCurrency(value: number): string {
  const v = Number.isFinite(value) ? value : 0;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateBR(dateLike: any): string {
  if (!dateLike) return "";
  const d = new Date(dateLike);
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

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

/* =========================
  Bottom Sheet (Assessoria)
========================= */

function useBottomSheet() {
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  function show() {
    setOpen(true);
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  function hide() {
    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setOpen(false);
    });
  }

  const backdropOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.55],
  });

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [360, 0],
  });

  return { open, show, hide, backdropOpacity, translateY };
}

/* =========================
  Badge (não lidas)
========================= */
function Badge({ count }: { count: number }) {
  if (!count || count <= 0) return null;
  const text = count > 99 ? "99+" : String(count);
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

/**
 * =========================
 * Push register (mobile)
 * =========================
 */
async function registerForPushOnce() {
  try {
    console.log("🔔 [Push] start registerForPushOnce");

    if (!Device.isDevice) {
      console.log("⚠️ [Push] not a physical device");
      return;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log("🔔 [Push] existingStatus:", existingStatus);

    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    console.log("🔔 [Push] finalStatus:", finalStatus);

    if (finalStatus !== "granted") {
      console.log("❌ [Push] permission denied");
      return;
    }

    const projectId =
      (Constants as any)?.expoConfig?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId;

    if (!projectId) {
      console.log("❌ [Push] projectId missing");
      return;
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log("✅ [Push] Expo token:", token);

    await api.post("/push/token", { expo_push_token: token });
    console.log("✅ [Push] token sent to backend");

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
      });
    }
  } catch (err: any) {
    console.log("❌ [Push] error:", err?.message ?? err);
  }
}

export function HomeScreen({ navigation, onLogout }: Props) {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(true);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const [firstName, setFirstName] = useState<string>("");

  const [financialById, setFinancialById] = useState<Record<string, OperationFinancial | undefined>>(
    {}
  );
  const [loadingFinancial, setLoadingFinancial] = useState(false);

  // ✅ NOVO: pull-to-refresh
  const [refreshing, setRefreshing] = useState(false);

  const pushRegisteredRef = useRef(false);

  const ADVISOR = {
    name: "Otavio Souza",
    phone: "(35) 99720-7039",
    email: "otavio@teste.com.br",
  };

  const sheet = useBottomSheet();

  const isHomeReady = useMemo(() => {
    if (loading) return false;
    if (!operations || operations.length === 0) return false;
    if (loadingFinancial) return false;
    return true;
  }, [loading, operations, loadingFinancial]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.get("/notifications/unread-count", { timeout: 20000 });
      const unread = Number(res.data?.unread ?? 0);
      setUnreadCount(Number.isFinite(unread) ? unread : 0);
    } catch {
      // silencioso
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoadingNotifs(true);

      const key = CACHE_KEYS.NOTIFICATIONS("me-v2");
      const cached = cacheGet<any>(key);

      if (cached?.notifications && Array.isArray(cached.notifications)) {
        const sortedCached = sortNotificationsByDate(cached.notifications);
        setNotifications(sortedCached);
        setLoadingNotifs(false);
      }

      const data = await getOrFetch(key, async () => {
        const res = await api.get("/notifications", { timeout: 30000 });
        return res.data ?? {};
      });

      const list = Array.isArray(data?.notifications) ? data.notifications : [];
      const sortedList = sortNotificationsByDate(list);
      setNotifications(sortedList);
    } catch {
      setNotifications((prev) => (prev?.length ? prev : []));
    } finally {
      setLoadingNotifs(false);
    }
  }, []);

  // ✅ Atualiza badge e lista quando a Home ganha foco
  useFocusEffect(
    useCallback(() => {
      fetchUnreadCount();
      fetchNotifications();
    }, [fetchUnreadCount, fetchNotifications])
  );

  // /me e /operations em paralelo
  useEffect(() => {
    let alive = true;

    async function loadData() {
      try {
        // Prefill cache
        const cached = cacheGet<any>(CACHE_KEYS.ME);
        if (cached) {
          const party = cached.party ?? {};
          const fn =
            String(party.firstName ?? cached.firstName ?? "").trim() ||
            firstNameFromFullName(String(party.name ?? cached.fullName ?? "").trim());
          if (alive) setFirstName(fn);
        }

        const cachedOps = cacheGet<Operation[]>(CACHE_KEYS.OPERATIONS);
        if (cachedOps && Array.isArray(cachedOps)) {
          if (!alive) return;
          setOperations(cachedOps);
          setLoading(false);
        } else {
          if (!alive) return;
          setLoading(true);
        }

        // Carrega ambos em paralelo
        const [meData, ops] = await Promise.all([
          getOrFetch(CACHE_KEYS.ME, async () => {
            const res = await api.get("/me", { timeout: 15000 });
            return res.data ?? {};
          }),
          getOrFetch(CACHE_KEYS.OPERATIONS, async () => {
            const res = await api.get("/operations", { timeout: 30000 });
            const data = (res.data ?? []) as Operation[];
            return Array.isArray(data) ? data : [];
          }),
        ]);

        if (!alive) return;

        const party = meData.party ?? {};
        const fn =
          String(party.firstName ?? meData.firstName ?? "").trim() ||
          firstNameFromFullName(String(party.name ?? meData.fullName ?? "").trim());
        setFirstName(fn);

        setOperations(ops);

        if (!pushRegisteredRef.current) {
          pushRegisteredRef.current = true;
          registerForPushOnce();
        }
      } catch (err) {
        if (!alive) return;
        setFirstName("");
        setOperations((prev) => (prev?.length ? prev : []));
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    loadData();
    return () => {
      alive = false;
    };
  }, []);

  // financeiro
  useEffect(() => {
    let alive = true;

    async function loadFinancial() {
      try {
        if (!operations || operations.length === 0) return;

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

        if (!alive) return;
        setLoadingFinancial(true);

        const results: Record<string, OperationFinancial | undefined> = {};

        // Carrega TODAS as operações em paralelo
        await Promise.all(
          operations.map(async (op) => {
            const id = String(op.id).trim();
            if (!id) return;

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
            } catch {
              results[id] = undefined;
            }
          })
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

  const totalOperations = operations.length;
  const activeOperations = operations.filter((op) => op.status === "em_andamento").length;
  const finishedOperations = totalOperations - activeOperations;

  const summary = useMemo(() => getSummaryFromOperations(operations, financialById), [
    operations,
    financialById,
  ]);

  const latestNotifs = (notifications ?? []).slice(0, 2);
  const greetingName = firstName ? capitalizeFirstName(firstName) : "investidor";

  async function openEmail() {
    const url = `mailto:${ADVISOR.email}`;
    const can = await Linking.canOpenURL(url);
    if (can) Linking.openURL(url);
  }

  async function openPhone() {
    const digits = ADVISOR.phone.replace(/[^\d+]/g, "");
    const url = `tel:${digits}`;
    const can = await Linking.canOpenURL(url);
    if (can) Linking.openURL(url);
  }

  // ✅ NOVO: pull-to-refresh - força atualização de todos os dados
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Limpa cache e força atualização de todos os dados
      const keyMe = CACHE_KEYS.ME;
      const keyOps = CACHE_KEYS.OPERATIONS;
      const keyNotifs = CACHE_KEYS.NOTIFICATIONS("me-v2");

      // Força atualização de /me
      const meData = await getOrFetch(
        keyMe,
        async () => {
          const res = await api.get("/me", { timeout: 15000 });
          return res.data ?? {};
        },
        { force: true }
      );

      const party = meData.party ?? {};
      const fn =
        String(party.firstName ?? meData.firstName ?? "").trim() ||
        firstNameFromFullName(String(party.name ?? meData.fullName ?? "").trim());
      setFirstName(fn);

      // Força atualização de operations
      const ops = await getOrFetch(
        keyOps,
        async () => {
          const res = await api.get("/operations", { timeout: 30000 });
          const data = (res.data ?? []) as Operation[];
          return Array.isArray(data) ? data : [];
        },
        { force: true }
      );
      setOperations(ops);

      // Força atualização de financial para todas as operações
      if (ops.length > 0) {
        const financialResults: Record<string, OperationFinancial | undefined> = {};
        await Promise.all(
          ops.slice(0, 6).map(async (op) => {
            const id = String(op.id).trim();
            if (!id) return;
            const roiExpectedPercent = roiToPercent(op.roi);
            const key = CACHE_KEYS.OP_FINANCIAL(id, roiExpectedPercent);
            try {
              const d = await getOrFetch(
                key,
                async () => {
                  const finRes = await api.get(`/operation-financial/${id}`, {
                    params: { roi_expected: roiExpectedPercent },
                    timeout: 30000,
                  });
                  return finRes.data ?? {};
                },
                { force: true }
              );
              financialResults[id] = buildFinancialFromApi(d, roiExpectedPercent);
            } catch {
              financialResults[id] = undefined;
            }
          })
        );
        setFinancialById((prev) => ({ ...prev, ...financialResults }));
      }

      // Força atualização de notifications
      const notifData = await getOrFetch(
        keyNotifs,
        async () => {
          const res = await api.get("/notifications", { timeout: 30000 });
          return res.data ?? {};
        },
        { force: true }
      );
      const list = Array.isArray(notifData?.notifications) ? notifData.notifications : [];
      const sortedList = sortNotificationsByDate(list);
      setNotifications(sortedList);

      // Atualiza unread count
      await fetchUnreadCount();
    } catch (err) {
      console.log("❌ [HomeScreen] refresh error:", err);
    } finally {
      setRefreshing(false);
    }
  }, [fetchUnreadCount]);

  // ✅ LOADING
  if (!isHomeReady) {
    return (
      <Screen
        title=""
        onLogout={onLogout}
        padding={16}
        contentTopOffset={0}
        headerUnreadCount={unreadCount}
      >
        <View style={{ flex: 1, backgroundColor: MAIN_BLUE }}>
          <TriadeLoading />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      title=""
      onLogout={onLogout}
      padding={16}
      contentTopOffset={0}
      headerUnreadCount={unreadCount}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Olá, {greetingName}</Text>
        <Text style={styles.subtitle}>Acompanhe a evolução dos seus investimentos.</Text>
      </View>

      {/* Total */}
      <View style={styles.metricsRow}>
        <View style={[styles.metricCard, styles.metricCardBig]}>
          <Text style={styles.metricLabel}>Total dos investimentos</Text>
          <Text style={styles.metricValue}>{formatCurrency(summary.totalInvestedActive)}</Text>
        </View>
      </View>

      {/* Extrato / Oportunidades (ambos Em breve) */}
      <View style={styles.halfRow}>
        <View style={[styles.halfCard, styles.halfCardDisabled]}>
          <Text style={styles.halfTitleCenter}>Extrato</Text>
          <Text style={styles.halfSubtitle}>Em breve</Text>
        </View>

        <View style={[styles.halfCard, styles.halfCardDisabled]}>
          <Text style={styles.halfTitleCenter}>Oportunidades</Text>
          <Text style={styles.halfSubtitle}>Em breve</Text>
        </View>
      </View>

      {/* Resumo operações */}
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

      {/* Lucro / ROI médio */}
      <View style={styles.section}>
        <View style={styles.metricsRow}>
          <MetricCard label="Lucro realizado" value={formatCurrency(summary.totalRealizedProfit)} />
          <MetricCard label="ROI médio realizado" value={summary.averageRoi.toFixed(1) + "%"} />
        </View>
      </View>

      {/* Notificações */}
      <View style={styles.section}>
        <View style={styles.notifHeaderRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={styles.sectionTitle}>Últimas notificações</Text>
            <Badge count={unreadCount} />
          </View>

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
              key={String(n.id)}
              style={styles.notifCard}
              activeOpacity={0.85}
              onPress={() => navigation.navigate("Notifications")}
            >
              <Text style={styles.notifMeta}>
                {n.codigo_imovel ?? "Global"}
                {n.datahora ? ` • ${formatDateBR(n.datahora)}` : ""}
              </Text>

              <Text style={styles.notifShort}>{n.mensagem_curta ?? ""}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Assessoria */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Assessoria de investimentos</Text>

        <TouchableOpacity activeOpacity={0.85} onPress={sheet.show} style={styles.advisorCard}>
          <View style={styles.advisorLeft}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>OS</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.advisorSmall}>Sua assessoria</Text>
              <Text style={styles.advisorName}>{ADVISOR.name}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.contactBtn}
            activeOpacity={0.85}
            onPress={(e) => {
              e.stopPropagation();
              sheet.show();
            }}
          >
            <Text style={styles.contactBtnText}>Contato</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>

      {/* Bottom sheet contato */}
      <Modal visible={sheet.open} transparent animationType="none" onRequestClose={sheet.hide}>
        <Pressable style={StyleSheet.absoluteFill} onPress={sheet.hide}>
          <Animated.View style={[styles.backdrop, { opacity: sheet.backdropOpacity }]} />
        </Pressable>

        <Animated.View style={[styles.sheet, { transform: [{ translateY: sheet.translateY }] }]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Contato</Text>
            <TouchableOpacity onPress={sheet.hide} activeOpacity={0.85} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>×</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sheetSubtitle}>Como você prefere ser atendido pela sua assessoria?</Text>

          <TouchableOpacity style={styles.sheetRow} activeOpacity={0.85} onPress={openEmail}>
            <View style={styles.sheetIcon}>
              <Text style={styles.sheetIconText}>✉️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetRowTitle}>E-mail</Text>
              <Text style={styles.sheetRowSub}>{ADVISOR.email}</Text>
            </View>
            <Text style={styles.sheetChevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sheetRow} activeOpacity={0.85} onPress={openPhone}>
            <View style={styles.sheetIcon}>
              <Text style={styles.sheetIconText}>📞</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetRowTitle}>Telefone</Text>
              <Text style={styles.sheetRowSub}>{ADVISOR.phone}</Text>
            </View>
            <Text style={styles.sheetChevron}>›</Text>
          </TouchableOpacity>

          <View style={{ height: 18 }} />
        </Animated.View>
      </Modal>
    </Screen>
  );
}

export default HomeScreen;

const styles = StyleSheet.create({
  header: { marginTop: 12, marginBottom: 16 },
  welcomeText: { fontSize: 22, fontWeight: "600", color: TRI.text },
  subtitle: { fontSize: 14, color: TRI.sub },
  helperText: { marginTop: 6, fontSize: 12, color: TRI.muted },

  section: { marginTop: 20 },
  sectionTitle: { fontSize: 18, color: TRI.text, marginBottom: 8, fontWeight: "600" },

  metricsRow: { flexDirection: "row", gap: 12, marginBottom: 12 },

  metricCard: { flex: 1, backgroundColor: TRI.card, borderRadius: 12, padding: 12 },
  metricCardBig: { paddingVertical: 16 },
  metricLabel: { color: TRI.muted, fontSize: 12 },
  metricValue: { color: TRI.text, fontSize: 18, fontWeight: "800", marginTop: 6 },

  halfRow: { flexDirection: "row", gap: 12, marginTop: 4 },
  halfCard: {
    flex: 1,
    backgroundColor: TRI.card,
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  halfCardDisabled: { opacity: 0.75 },
  halfTitleCenter: { color: TRI.text, fontSize: 14, fontWeight: "800", textAlign: "center" },
  halfSubtitle: { color: TRI.muted, fontSize: 11, marginTop: 6, fontWeight: "700" },

  operationsCard: { backgroundColor: TRI.card, borderRadius: 12, padding: 16 },
  operationsTitle: { color: TRI.text, fontSize: 16, fontWeight: "600", marginBottom: 4 },
  operationsSubtitle: { color: "#C5D2E0", fontSize: 13, marginBottom: 10 },
  operationsLinkText: { color: TRI.link, fontSize: 13, fontWeight: "500" },

  notifHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  notifLink: { color: TRI.link, fontSize: 13, fontWeight: "600" },
  notifEmpty: { color: TRI.muted, fontSize: 13 },
  notifCard: { backgroundColor: TRI.card, borderRadius: 12, padding: 12 },
  notifMeta: { color: TRI.muted, fontSize: 11, marginBottom: 6 },
  notifShort: { color: TRI.text, fontSize: 14, fontWeight: "700" },

  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TRI.red,
    borderWidth: 2,
    borderColor: MAIN_BLUE,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "900" },

  advisorCard: {
    backgroundColor: TRI.card,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  advisorLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: TRI.text, fontWeight: "900" },
  advisorSmall: { color: TRI.muted, fontSize: 12, fontWeight: "700" },
  advisorName: { color: TRI.text, fontSize: 16, fontWeight: "800", marginTop: 2 },
  contactBtn: {
    backgroundColor: "rgba(245, 191, 66, 0.18)",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  contactBtnText: { color: "#F5BF42", fontWeight: "900", fontSize: 13 },

  backdrop: { flex: 1, backgroundColor: "#000" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#0F2E4F",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 16,
    paddingBottom: 26,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { color: TRI.text, fontSize: 18, fontWeight: "900" },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  closeBtnText: { color: TRI.text, fontSize: 22, fontWeight: "900" },
  sheetSubtitle: {
    color: TRI.muted,
    marginTop: 8,
    marginBottom: 14,
    fontSize: 12,
    fontWeight: "700",
  },

  sheetRow: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sheetIcon: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  sheetIconText: { fontSize: 16 },
  sheetRowTitle: { color: TRI.text, fontWeight: "900", fontSize: 14 },
  sheetRowSub: { color: TRI.muted, marginTop: 4, fontWeight: "700" },
  sheetChevron: { color: TRI.muted, fontSize: 22, marginLeft: 10, fontWeight: "900" },
});
