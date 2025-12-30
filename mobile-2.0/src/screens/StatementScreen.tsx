// src/screens/StatementScreen.tsx

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppStackParamList } from "../navigation/types";

import TriadeLoading from "../ui/TriadeLoading";
import { api } from "../services/api";
import { lastLoginStorage } from "../storage/lastLoginStorage";

import { cacheGet, getOrFetch, cacheClear } from "../cache/memoryCache";
import { CACHE_KEYS } from "../cache/cacheKeys";

const MAIN_BLUE = "#0E2A47";

type StatementItem = {
  id?: string;
  date?: string | null; // YYYY-MM-DD
  description?: string;
  amount?: number; // + entrada / - saída (já vem invertido do backend pro investidor)
  type?: "entrada" | "saida";
};

type StatementApiResponse = {
  ok: boolean;
  start?: string;
  end?: string;
  items?: StatementItem[];
  totals?: { in: number; out: number; net: number };
};

type Props = NativeStackScreenProps<AppStackParamList, "Statement">;

type Mode = "30" | "90" | "custom";

/* =========================
   Utils
========================= */

function toYmd(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, delta: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + delta);
  return d;
}

function formatBrDate(value?: string | null) {
  if (!value) return "—";
  const raw = String(value).trim();

  // YYYY-MM-DD -> DD/MM/YYYY (sem timezone)
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [, yyyy, mm, dd] = m;
    return `${dd}/${mm}/${yyyy}`;
  }

  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  return raw;
}

function formatCurrency(value: number) {
  const v = Number.isFinite(value) ? value : 0;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * ✅ Máscara DD/MM/AAAA (digita só números)
 */
function maskBrDateInput(text: string) {
  const digits = String(text ?? "").replace(/\D/g, "").slice(0, 8);

  const d = digits.slice(0, 2);
  const m = digits.slice(2, 4);
  const y = digits.slice(4, 8);

  let out = d;
  if (digits.length >= 3) out = `${d}/${m}`;
  if (digits.length >= 5) out = `${d}/${m}/${y}`;
  return out;
}

/** DD/MM/AAAA -> YYYY-MM-DD (valida data real) */
function parseBrToYmd(input: string): string | null {
  const raw = String(input ?? "").trim();
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;

  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);

  if (!yyyy || mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;

  const d = new Date(yyyy, mm - 1, dd);
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;

  return `${String(yyyy).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/* =========================
   Screen
========================= */

export function StatementScreen({ navigation }: Props) {
  const [cpf, setCpf] = useState<string>("");

  const [mode, setMode] = useState<Mode>("30");

  // Inputs do personalizado (com máscara)
  const defaultStartBr = formatBrDate(toYmd(addDays(new Date(), -30)));
  const defaultEndBr = formatBrDate(toYmd(new Date()));

  const [customStartText, setCustomStartText] = useState<string>(defaultStartBr);
  const [customEndText, setCustomEndText] = useState<string>(defaultEndBr);

  // ✅ datas aplicadas (só mudam quando clica "Buscar")
  const [appliedCustomStart, setAppliedCustomStart] = useState<string>(defaultStartBr);
  const [appliedCustomEnd, setAppliedCustomEnd] = useState<string>(defaultEndBr);

  const [items, setItems] = useState<StatementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1) CPF do login
  useEffect(() => {
    let alive = true;
    (async () => {
      const c = await lastLoginStorage.getCpf();
      if (!alive) return;
      setCpf(String(c ?? "").replace(/\D/g, ""));
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 2) range calculado por modo (YYYY-MM-DD)
  const { startIso, endIso, periodLabel } = useMemo(() => {
    const now = new Date();

    if (mode === "custom") {
      const start = parseBrToYmd(appliedCustomStart);
      const end = parseBrToYmd(appliedCustomEnd);

      return {
        startIso: start ?? "",
        endIso: end ?? "",
        periodLabel:
          start && end ? `${formatBrDate(start)} até ${formatBrDate(end)}` : "Informe datas válidas (DD/MM/AAAA)",
      };
    }

    const end = now;
    const start = mode === "90" ? addDays(end, -90) : addDays(end, -30);

    const s = toYmd(start);
    const e = toYmd(end);

    return {
      startIso: s,
      endIso: e,
      periodLabel: `${formatBrDate(s)} até ${formatBrDate(e)}`,
    };
  }, [mode, appliedCustomStart, appliedCustomEnd]);

  // 3) chave de cache (depende do range final)
  const cacheKey = useMemo(() => {
    if (!cpf) return "";
    const s = startIso || "invalid";
    const e = endIso || "invalid";
    return CACHE_KEYS.STATEMENT
      ? CACHE_KEYS.STATEMENT(cpf, mode, s, e)
      : `statement:${cpf}:${mode}:${s}:${e}`;
  }, [cpf, mode, startIso, endIso]);

  // helper: validar custom antes de buscar
  const customValid = useMemo(() => {
    if (mode !== "custom") return true;
    return !!parseBrToYmd(customStartText) && !!parseBrToYmd(customEndText);
  }, [mode, customStartText, customEndText]);

  async function handleApplyCustom() {
    if (mode !== "custom") return;

    const startYmd = parseBrToYmd(customStartText);
    const endYmd = parseBrToYmd(customEndText);

    if (!startYmd || !endYmd) {
      setErrorMsg("Datas inválidas. Use DD/MM/AAAA.");
      return;
    }

    Keyboard.dismiss();
    setErrorMsg(null);

    setAppliedCustomStart(customStartText);
    setAppliedCustomEnd(customEndText);

    const futureKey =
      CACHE_KEYS.STATEMENT
        ? CACHE_KEYS.STATEMENT(cpf, "custom", startYmd, endYmd)
        : `statement:${cpf}:custom:${startYmd}:${endYmd}`;

    cacheClear(futureKey);
  }

  // 4) load
  useEffect(() => {
    let alive = true;

    async function load() {
      if (!cpf) return;

      if (mode === "custom" && (!startIso || !endIso)) {
        setItems([]);
        setErrorMsg("Informe as datas no formato DD/MM/AAAA.");
        setLoading(false);
        return;
      }

      try {
        setErrorMsg(null);

        console.log("🧾 [Statement] cpf =", cpf);
        console.log("🧾 [Statement] mode/start/end =", mode, startIso, endIso);
        console.log("🧾 [Statement] key =", cacheKey);

        const cached = cacheGet<StatementApiResponse>(cacheKey);
        if (cached?.items && Array.isArray(cached.items)) {
          if (!alive) return;
          setItems(cached.items);
          setLoading(false);
        } else {
          if (!alive) return;
          setLoading(true);
        }

        const data = await getOrFetch(cacheKey, async () => {
          console.log("➡️ [Statement] calling /financial/statement", { mode, startIso, endIso });
          const res = await api.get("/financial/statement", {
            params: { mode, start: startIso, end: endIso },
            timeout: 30000,
          });
          return (res.data ?? {}) as StatementApiResponse;
        });

        if (!alive) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch (err: any) {
        console.log(
          "❌ [StatementScreen] load error:",
          err?.message,
          err?.response?.status,
          err?.response?.data
        );
        if (!alive) return;
        setErrorMsg("Não foi possível carregar o extrato.");
        setItems((prev) => (prev?.length ? prev : []));
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [cpf, cacheKey, mode, startIso, endIso]);

  // totais (visão investidor: entrada = +, saída = -)
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const it of items) {
      const a = Number(it.amount ?? 0);
      if (a >= 0) income += a;
      else expense += Math.abs(a);
    }
    return { income, expense, net: income - expense };
  }, [items]);

  const showFullLoading = loading && items.length === 0;

  // ✅ INVERTE A ORDEM (mais antigo em cima)
  const itemsAsc = useMemo(() => [...items].reverse(), [items]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {showFullLoading ? (
        <TriadeLoading />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
              style={styles.backBtn}
            >
              <Text style={styles.backText}>← Voltar</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Extrato</Text>
            <View style={{ width: 70 }} />
          </View>

          <Text style={styles.title}>Extrato</Text>
          <Text style={styles.subtitle}>Movimentações do período selecionado.</Text>

          {/* Seletor 30 / 90 / Personalizado */}
          <View style={styles.modeRow}>
            <ModeBtn label="30 dias" active={mode === "30"} onPress={() => setMode("30")} />
            <ModeBtn label="90 dias" active={mode === "90"} onPress={() => setMode("90")} />
            <ModeBtn
              label="Personalizado"
              active={mode === "custom"}
              onPress={() => setMode("custom")}
            />
          </View>

          {/* Personalizado inputs + botão */}
          {mode === "custom" && (
            <>
              <View style={styles.customRow}>
                <View style={styles.inputBox}>
                  <Text style={styles.inputLabel}>Início</Text>
                  <TextInput
                    value={customStartText}
                    onChangeText={(t) => setCustomStartText(maskBrDateInput(t))}
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor="#7E8EA3"
                    style={styles.input}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>

                <View style={styles.inputBox}>
                  <Text style={styles.inputLabel}>Fim</Text>
                  <TextInput
                    value={customEndText}
                    onChangeText={(t) => setCustomEndText(maskBrDateInput(t))}
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor="#7E8EA3"
                    style={styles.input}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>
              </View>

              <TouchableOpacity
                onPress={handleApplyCustom}
                activeOpacity={0.85}
                disabled={!customValid}
                style={[styles.searchBtn, !customValid && styles.searchBtnDisabled]}
              >
                <Text style={styles.searchBtnText}>Buscar</Text>
              </TouchableOpacity>

              <Text style={styles.customHint}>
                {customValid
                  ? "Dica: digite só números (ex: 29122025)."
                  : "Preencha as duas datas corretamente."}
              </Text>
            </>
          )}

          {/* Período */}
          <View style={styles.periodCard}>
            <Text style={styles.periodText}>Período: {periodLabel}</Text>
          </View>

          {!!errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

          {/* Totais */}
          <View style={styles.totalsRow}>
            <TotalCard label="Entradas" value={formatCurrency(totals.income)} />
            <TotalCard label="Saídas" value={formatCurrency(totals.expense)} />
          </View>

          <View style={styles.netCard}>
            <Text style={styles.netLabel}>Saldo líquido</Text>
            <Text style={styles.netValue}>{formatCurrency(totals.net)}</Text>
          </View>

          {/* Lista */}
          <View style={{ marginTop: 14 }}>
            {itemsAsc.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma movimentação encontrada nesse período.</Text>
            ) : (
              itemsAsc.map((it, idx) => {
                const amount = Number(it.amount ?? 0);
                const isIncome = amount >= 0;

                return (
                  <View key={it.id ?? String(idx)} style={styles.itemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{it.description ?? "Movimentação"}</Text>
                      <Text style={styles.itemSub}>{formatBrDate(it.date ?? undefined)}</Text>
                    </View>

                    <Text style={[styles.itemValue, isIncome ? styles.valueGreen : styles.valueRed]}>
                      {isIncome ? "+" : "-"}
                      {formatCurrency(Math.abs(amount))}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

export default StatementScreen;

function ModeBtn({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.modeBtn, active && styles.modeBtnActive]}
    >
      <Text style={[styles.modeBtnText, active && styles.modeBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function TotalCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.totalCard}>
      <Text style={styles.totalLabel}>{label}</Text>
      <Text style={styles.totalValue}>{value}</Text>
    </View>
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

  title: { fontSize: 22, color: "#FFFFFF", fontWeight: "600" },
  subtitle: { fontSize: 14, color: "#D0D7E3", marginTop: 4 },

  modeRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  modeBtn: {
    flex: 1,
    backgroundColor: "#14395E",
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center",
  },
  modeBtnActive: { backgroundColor: "#2F80ED55" },
  modeBtnText: { color: "#C3C9D6", fontSize: 12, fontWeight: "700" },
  modeBtnTextActive: { color: "#FFFFFF" },

  customRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  inputBox: { flex: 1 },
  inputLabel: { color: "#C3C9D6", fontSize: 11, fontWeight: "700", marginBottom: 6 },
  input: {
    backgroundColor: "#14395E",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: "#FFFFFF",
    fontWeight: "700",
  },

  searchBtn: {
    marginTop: 10,
    backgroundColor: "#2F80ED",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  searchBtnDisabled: { opacity: 0.5 },
  searchBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },

  customHint: { marginTop: 8, color: "#C3C9D6", fontSize: 11 },

  periodCard: { marginTop: 10, backgroundColor: "#14395E", borderRadius: 12, padding: 12 },
  periodText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },

  errorText: { color: "#FFB4B4", fontSize: 13, marginTop: 10 },

  totalsRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  totalCard: { flex: 1, backgroundColor: "#14395E", borderRadius: 12, padding: 12 },
  totalLabel: { color: "#C3C9D6", fontSize: 12 },
  totalValue: { color: "#FFFFFF", fontSize: 14, fontWeight: "800", marginTop: 6 },

  netCard: { marginTop: 12, backgroundColor: "#14395E", borderRadius: 12, padding: 12 },
  netLabel: { color: "#C3C9D6", fontSize: 12 },
  netValue: { color: "#FFFFFF", fontSize: 15, fontWeight: "900", marginTop: 6 },

  emptyText: { marginTop: 12, color: "#D0D7E3", fontSize: 13 },

  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#14395E",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  itemTitle: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  itemSub: { color: "#C3C9D6", fontSize: 11, marginTop: 4 },

  itemValue: { fontSize: 13, fontWeight: "900", marginLeft: 12 },
  valueGreen: { color: "#27AE60" },
  valueRed: { color: "#EB5757" },
});
