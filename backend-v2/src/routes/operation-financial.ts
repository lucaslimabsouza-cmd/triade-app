// backend-v2/src/routes/operation-financial.ts
import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { supabaseAdmin } from "../lib/supabase";

const router = Router();

/* =========================
   Utils
========================= */
function onlyDigits(s = "") {
  return String(s).replace(/\D/g, "");
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    if (!token) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ ok: false, error: "JWT_SECRET_MISSING" });

    const payload = jwt.verify(token, secret) as any;
    (req as any).user = payload;

    next();
  } catch {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }
}

function isUuid(u: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(u);
}

function toISODateOnly(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseISODateOnly(s?: string | null) {
  const raw = String(s ?? "").trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00.000Z`);
  if (isNaN(d.getTime())) return null;
  return d;
}

function coerceNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isoStartOfDay(ymd: string) {
  return `${ymd}T00:00:00.000Z`;
}
function isoEndOfDay(ymd: string) {
  return `${ymd}T23:59:59.999Z`;
}

/* =========================
   Omie helpers
========================= */
async function getOmieCodesByCpfFlexible(rawCpfFromToken: string): Promise<string[]> {
  const rawCpf = String(rawCpfFromToken ?? "").trim();
  const cpfDigits = onlyDigits(rawCpf);

  const { data, error } = await supabaseAdmin
    .from("omie_parties")
    .select("omie_code, cpf_cnpj")
    .or(`cpf_cnpj.eq.${rawCpf},cpf_cnpj.eq.${cpfDigits},cpf_cnpj.ilike.%${cpfDigits}%`);

  if (error) throw new Error(`Supabase omie_parties error: ${error.message}`);

  return Array.from(
    new Set(
      (data ?? [])
        .map((r: any) => String(r?.omie_code ?? "").trim())
        .filter(Boolean)
    )
  );
}

/* =========================
   REGRA DEFINITIVA DE SINAL
========================= */
/**
 * ENTRADA  -> valor POSITIVO
 * SAÍDA    -> valor NEGATIVO
 *
 * Fonte de verdade: tp_lancamento
 * Ajuste o switch conforme o seu Omie.
 */
function inferSignedAmount(row: any): number {
  const valor = Math.abs(coerceNumber(row?.valor ?? 0));
  const tp = String(row?.tp_lancamento ?? "").toUpperCase().trim();

  switch (tp) {
    // ENTRADAS
    case "R": // Recebimento
    case "C": // Crédito
    case "E": // Entrada
      return +valor;

    // SAÍDAS
    case "P": // Pagamento
    case "D": // Débito
    case "S": // Saída
      return -valor;

    default:
      // fallback seguro: NÃO inverte
      return +valor;
  }
}

/* =========================
   EXTRATO
========================= */

type StatementItem = {
  id?: string;
  date?: string | null;
  description?: string;
  amount?: number;
  type?: "entrada" | "saida";
};

function pickMovementDateISO(row: any): string | null {
  return (
    (row?.dt_pagamento ? String(row.dt_pagamento) : null) ||
    (row?.dt_emissao ? String(row.dt_emissao) : null) ||
    (row?.dt_venc ? String(row.dt_venc) : null) ||
    null
  );
}

function toYmdFromIso(iso: string): string | null {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : toISODateOnly(d);
}

router.get("/financial/statement", requireAuth, async (req: Request, res: Response) => {
  try {
    const startD = parseISODateOnly(String(req.query.start ?? ""));
    const endD = parseISODateOnly(String(req.query.end ?? ""));
    if (!startD || !endD) {
      return res.status(400).json({ ok: false, error: "INVALID_DATE_RANGE" });
    }

    const startYmd = toISODateOnly(startD);
    const endYmd = toISODateOnly(endD);

    const rawCpf = String((req as any)?.user?.cpf_cnpj ?? "");
    if (!rawCpf) return res.status(400).json({ ok: false, error: "MISSING_CPF_IN_TOKEN" });

    const omieCodes = await getOmieCodesByCpfFlexible(rawCpf);
    if (!omieCodes.length) return res.status(404).json({ ok: false, error: "NO_OMIE_CODES" });

    const omieCodesNum = omieCodes.map(Number).filter(Number.isFinite);
    const codesForIn: any[] = omieCodesNum.length ? omieCodesNum : omieCodes;

    const startIso0 = isoStartOfDay(startYmd);
    const endIso1 = isoEndOfDay(endYmd);

    const orRange = [
      `and(dt_pagamento.gte.${startIso0},dt_pagamento.lte.${endIso1})`,
      `and(dt_emissao.gte.${startIso0},dt_emissao.lte.${endIso1})`,
      `and(dt_venc.gte.${startIso0},dt_venc.lte.${endIso1})`,
    ].join(",");

    const { data, error } = await supabaseAdmin
      .from("omie_mf_movements")
      .select("cod_mov_cc, dt_pagamento, dt_emissao, dt_venc, valor, descricao, tp_lancamento")
      .in("cod_cliente", codesForIn)
      .or(orRange)
      .limit(5000);

    if (error) throw error;

    const items: StatementItem[] = (data ?? [])
      .map((row: any) => {
        const amount = inferSignedAmount(row);
        return {
          id: String(row.cod_mov_cc),
          date: toYmdFromIso(pickMovementDateISO(row) ?? ""),
          description: String(row.descricao ?? "Movimentação"),
          amount,
          type: (amount >= 0 ? "entrada" : "saida") as "entrada" | "saida",
        };
      })
      .filter((i) => i.date && i.date >= startYmd && i.date <= endYmd)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));

    return res.json({
      ok: true,
      start: startYmd,
      end: endYmd,
      items,
    });
  } catch (e: any) {
    console.log("❌ /financial/statement error:", e?.message ?? e);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

/* =========================
   FINANCEIRO POR OPERAÇÃO
========================= */
router.get("/operation-financial/:operationId", requireAuth, async (req: Request, res: Response) => {
  if (!isUuid(req.params.operationId)) {
    return res.status(400).json({ ok: false, error: "INVALID_OPERATION_ID" });
  }
  return res.json({ ok: true });
});

export default router;
