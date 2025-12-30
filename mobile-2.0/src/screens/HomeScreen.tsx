import React, { useEffect, useMemo, useRef, useState } from "react";
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
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppStackParamList } from "../navigation/types";
import Screen from "./Screen";

import { api } from "../services/api";
import { lastLoginStorage } from "../storage/lastLoginStorage";

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

function safeNumber(n: any) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
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

/**
 * =====================
 * Chart data
 * - Realizado (verde) sólido
 * - Esperado (azul) tracejado
 * - Esperado começa no último ponto do realizado (conecta)
 * =====================
 */

type ChartPoint = { x: number; y: number; kind: "realized" | "expected" };

function buildRoiChartData(
  operations: Operation[],
  financialById: Record<string, OperationFinancial | undefined>
) {
  const finished = operations.filter((o) => o.status === "concluida");
  const active = operations.filter((o) => o.status === "em_andamento");

  const realized: ChartPoint[] = finished
    .map((o, idx) => {
      const id = String(o.id);
      const fin = financialById[id];
      const y = safeNumber(fin?.realizedRoiPercent ?? 0);
      return { x: idx + 1, y, kind: "realized" as const };
    })
    .filter((p) => Number.isFinite(p.y));

  const expectedBase: ChartPoint[] = active
    .map((o, idx) => {
      const y = safeNumber(roiToPercent(o.roi));
      const x = realized.length + idx + 1;
      return { x, y, kind: "expected" as const };
    })
    .filter((p) => Number.isFinite(p.y));

  const expected: ChartPoint[] =
    realized.length > 0 && expectedBase.length > 0
      ? [
          {
            x: realized[realized.length - 1].x,
            y: realized[realized.length - 1].y,
            kind: "expected" as const,
          },
          ...expectedBase,
        ]
      : expectedBase;

  const all = [...realized, ...expected];
  const maxY = all.length ? Math.max(...all.map((p) => p.y)) : 0;

  const yMax = Math.max(10, Math.ceil((maxY * 1.2) / 5) * 5);
  const yMin = 0;

  return { realized, expected, yMin, yMax };
}

function mapToXY(
  points: ChartPoint[],
  w: number,
  h: number,
  yMin: number,
  yMax: number
): { x: number; y: number; raw: ChartPoint }[] {
  if (!points || points.length === 0) return [];

  const xs = points.map((p) => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);

  // ✅ se tiver só 1 ponto, centraliza
  const singlePoint = maxX === minX;

  const xSpan = Math.max(1, maxX - minX);
  const ySpan = Math.max(1e-6, yMax - yMin);

  return points.map((p) => {
    const x = singlePoint ? w / 2 : ((p.x - minX) / xSpan) * w;
    const y = h - ((p.y - yMin) / ySpan) * h;
    return { x, y, raw: p };
  });
}

function segmentsFromMapped(mapped: { x: number; y: number }[]) {
  const segs: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 0; i < mapped.length - 1; i++) {
    segs.push({ x1: mapped[i].x, y1: mapped[i].y, x2: mapped[i + 1].x, y2: mapped[i + 1].y });
  }
  return segs;
}

function SegmentLine({
  x1,
  y1,
  x2,
  y2,
  color,
  dashed,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  dashed?: boolean;
}) {
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  const length = Math.max(1, Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2));

  return (
    <View
      style={[
        styles.segBase,
        dashed ? styles.segDashed : styles.segSolid,
        {
          left: x1,
          top: y1,
          width: length,
          backgroundColor: color,
          transform: [{ rotateZ: `${angle}deg` }],
        },
      ]}
    />
  );
}

function Dot({
  x,
  y,
  borderColor,
  fillColor,
}: {
  x: number;
  y: number;
  borderColor: string;
  fillColor: string;
}) {
  return (
    <View
      style={[
        styles.dot,
        {
          left: x - 6,
          top: y - 6,
          borderColor,
          backgroundColor: fillColor, // ✅ ponto preenchido (não some)
        },
      ]}
    />
  );
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
  const anim = useRef(new Animated.Value(0)).current; // 0 fechado, 1 aberto

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

  // chart width responsive
  const [chartW, setChartW] = useState(0);
  const CHART_H = 160;

  // assessoria info (fixo por enquanto)
  const ADVISOR = {
    name: "Otavio Souza",
    phone: "(35) 99720-7039",
    email: "otavio@teste.com.br",
  };

  const sheet = useBottomSheet();

  // /me
  useEffect(() => {
    let alive = true;

    async function loadMe() {
      try {
        const cached = cacheGet<any>(CACHE_KEYS.ME);
        if (cached) {
          const party = cached.party ?? {};
          const fn =
            String(party.firstName ?? cached.firstName ?? "").trim() ||
            firstNameFromFullName(String(party.name ?? cached.fullName ?? "").trim());

          if (alive) setFirstName(fn);
        }

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

  // /operations
  useEffect(() => {
    let alive = true;

    async function loadOperations() {
      try {
        const cachedOps = cacheGet<Operation[]>(CACHE_KEYS.OPERATIONS);
        if (cachedOps && Array.isArray(cachedOps)) {
          if (!alive) return;
          setOperations(cachedOps);
          setLoading(false);
        } else {
          if (!alive) return;
          setLoading(true);
        }

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

  // notifs
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

        const cached = cacheGet<NotificationItem[]>(key);
        if (cached && Array.isArray(cached)) {
          if (!alive) return;
          setNotifications(cached);
          setLoadingNotifs(false);
        }

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

  const summary = useMemo(() => getSummaryFromOperations(operations, financialById), [
    operations,
    financialById,
  ]);

  const latestNotifs = (notifications ?? []).slice(0, 1);

  const greetingName = firstName ? capitalizeFirstName(firstName) : "investidor";

  // chart
  const chart = useMemo(() => buildRoiChartData(operations, financialById), [operations, financialById]);

  const realizedMapped = useMemo(() => {
    if (!chartW) return [];
    return mapToXY(chart.realized, chartW, CHART_H, chart.yMin, chart.yMax);
  }, [chart, chartW]);

  const expectedMapped = useMemo(() => {
    if (!chartW) return [];
    return mapToXY(chart.expected, chartW, CHART_H, chart.yMin, chart.yMax);
  }, [chart, chartW]);

  const realizedSegs = useMemo(() => segmentsFromMapped(realizedMapped), [realizedMapped]);
  const expectedSegs = useMemo(() => segmentsFromMapped(expectedMapped), [expectedMapped]);

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

  return (
    <Screen title="Home" onLogout={onLogout} padding={16} contentTopOffset={0}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Olá, {greetingName}</Text>
        <Text style={styles.subtitle}>Acompanhe a evolução dos seus investimentos.</Text>
        {loadingFinancial && <Text style={styles.helperText}>Atualizando valores financeiros...</Text>}
      </View>

      {/* Total (grande full width) */}
      <View style={styles.metricsRow}>
        <View style={[styles.metricCard, styles.metricCardBig]}>
          <Text style={styles.metricLabel}>Total dos investimentos</Text>
          <Text style={styles.metricValue}>{formatCurrency(summary.totalInvestedActive)}</Text>
        </View>
      </View>

      {/* Extrato / Oportunidades */}
      <View style={styles.halfRow}>
        <TouchableOpacity
          style={styles.halfCard}
          activeOpacity={0.85}
          onPress={() => navigation.navigate("Statement" as never)}
        >
          <Text style={styles.halfTitleCenter}>Extrato</Text>
        </TouchableOpacity>

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

      {/* Gráfico ROI */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Evolução do ROI (%)</Text>

        <View style={styles.chartCard}>
          <View style={styles.chartHeaderRow}>
            <Text style={styles.chartMeta}>0%</Text>
            <Text style={styles.chartMeta}>{chart.yMax.toFixed(0)}%</Text>
          </View>

          <View
            style={styles.chartAreaWrap}
            onLayout={(e) => {
              const w = Math.floor(e.nativeEvent.layout.width);
              if (w && w !== chartW) setChartW(w);
            }}
          >
            <View style={[styles.chartArea, { height: CHART_H }]}>
              {/* grid */}
              <View style={[styles.gridLine, { top: CHART_H * 0.25 }]} />
              <View style={[styles.gridLine, { top: CHART_H * 0.5 }]} />
              <View style={[styles.gridLine, { top: CHART_H * 0.75 }]} />

              {/* Realizado (verde) */}
              {realizedSegs.map((s, idx) => (
                <SegmentLine
                  key={`r-${idx}`}
                  x1={s.x1}
                  y1={s.y1}
                  x2={s.x2}
                  y2={s.y2}
                  color={TRI.green}
                />
              ))}
              {realizedMapped.map((p, idx) => (
                <Dot
                  key={`rd-${idx}`}
                  x={p.x}
                  y={p.y}
                  borderColor={TRI.green}
                  fillColor={TRI.green} // ✅ agora sempre aparece
                />
              ))}

              {/* Esperado (azul tracejado) */}
              {expectedSegs.map((s, idx) => (
                <SegmentLine
                  key={`e-${idx}`}
                  x1={s.x1}
                  y1={s.y1}
                  x2={s.x2}
                  y2={s.y2}
                  color={TRI.blue}
                  dashed
                />
              ))}
              {expectedMapped.map((p, idx) => (
                <Dot
                  key={`ed-${idx}`}
                  x={p.x}
                  y={p.y}
                  borderColor={TRI.blue}
                  fillColor={TRI.blue}
                />
              ))}
            </View>
          </View>

          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: TRI.green }]} />
              <Text style={styles.legendText}>Realizado (concluídas)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: TRI.blue }]} />
              <Text style={styles.legendText}>Esperado (em andamento)</Text>
            </View>
          </View>

          {chart.realized.length === 0 && chart.expected.length === 0 && (
            <Text style={styles.chartEmpty}>Sem dados suficientes para gerar o gráfico.</Text>
          )}
        </View>
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

{/* ✅ Assessoria (card clicável abrindo bottom sheet) */}
<View style={styles.section}>
  <Text style={styles.sectionTitle}>Assessoria de investimentos</Text>

  <TouchableOpacity
    activeOpacity={0.85}
    onPress={sheet.show}
    style={styles.advisorCard}
  >
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
        e.stopPropagation(); // ✅ impede disparar o onPress do card
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

          <Text style={styles.sheetSubtitle}>
            Como você prefere ser atendido pela sua assessoria?
          </Text>

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

  // halves
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

  // operations
  operationsCard: { backgroundColor: TRI.card, borderRadius: 12, padding: 16 },
  operationsTitle: { color: TRI.text, fontSize: 16, fontWeight: "600", marginBottom: 4 },
  operationsSubtitle: { color: "#C5D2E0", fontSize: 13, marginBottom: 10 },
  operationsLinkText: { color: TRI.link, fontSize: 13, fontWeight: "500" },

  // chart
  chartCard: {
    backgroundColor: TRI.card,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  chartHeaderRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  chartMeta: { color: TRI.muted, fontSize: 12, fontWeight: "900" },
  chartAreaWrap: { width: "100%" },
  chartArea: {
    width: "100%",
    backgroundColor: TRI.card2,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: TRI.line,
    opacity: 0.35,
  },
  segBase: {
    position: "absolute",
    height: 3,
    borderRadius: 3,
    transformOrigin: "0% 50%",
  },
  segSolid: { opacity: 1 },
  segDashed: {
    opacity: 0.95,
    // “tracejado” simples com borda
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  dot: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 999,
    borderWidth: 3,
  },
  legendRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 10,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  legendSwatch: { width: 10, height: 10, borderRadius: 999 },
  legendText: { color: TRI.muted, fontSize: 12, fontWeight: "800" },
  chartEmpty: { marginTop: 10, color: TRI.muted, fontSize: 12, fontWeight: "700" },

  // notifications
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
  notifShort: { color: TRI.text, fontSize: 14, fontWeight: "700", marginBottom: 6 },
  notifLong: { color: "#E2E6F0", fontSize: 12, lineHeight: 18 },

  // advisor (igual antes)
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

  // bottom sheet
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
  sheetSubtitle: { color: TRI.muted, marginTop: 8, marginBottom: 14, fontSize: 12, fontWeight: "700" },

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
