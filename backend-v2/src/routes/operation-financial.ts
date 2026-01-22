// backend-v2/src/routes/operation-financial.ts
import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { supabaseAdmin } from "../lib/supabase";

const router = Router();

/* =========================
   Helpers
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

function normName(s: string) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
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

  // date-only (sem timezone do usuário)
  const d = new Date(`${raw}T00:00:00.000Z`);
  if (isNaN(d.getTime())) return null;
  return d;
}

function coerceNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isoStartOfDay(ymd: string) {
  // ymd = YYYY-MM-DD
  return `${ymd}T00:00:00.000Z`;
}
function isoEndOfDay(ymd: string) {
  return `${ymd}T23:59:59.999Z`;
}

/** ✅ Busca omieCodes com/sem pontuação */
async function getOmieCodesByCpfFlexible(rawCpfFromToken: string): Promise<string[]> {
  const rawCpf = String(rawCpfFromToken ?? "").trim();
  const cpfDigits = onlyDigits(rawCpf);

  const { data, error } = await supabaseAdmin
    .from("omie_parties")
    .select("omie_code, cpf_cnpj")
    .or(`cpf_cnpj.eq.${rawCpf},cpf_cnpj.eq.${cpfDigits},cpf_cnpj.ilike.%${cpfDigits}%`);

  if (error) throw new Error(`Supabase omie_parties error: ${error.message}`);

  const codes =
    (data ?? [])
      .map((r: any) => String(r?.omie_code ?? "").trim())
      .filter((x: string) => x.length > 0) ?? [];

  return Array.from(new Set(codes));
}

/** ✅ Soma por projeto + categoria + cod_cliente IN (omieCodes) */
async function sumMovements(params: {
  projectInternalCode: string;
  categoryCode: string;
  omieCodes: string[];
}) {
  const { projectInternalCode, categoryCode, omieCodes } = params;

  if (!omieCodes || omieCodes.length === 0) return { total: 0, rows: 0 };

  const { data, error } = await supabaseAdmin
    .from("omie_mf_movements")
    .select("valor")
    .eq("cod_projeto", projectInternalCode)
    .eq("cod_categoria", categoryCode)
    .in("cod_cliente", omieCodes);

  if (error) throw new Error(`Supabase omie_mf_movements error: ${error.message}`);

  const total = (data ?? []).reduce((acc: number, row: any) => acc + Number(row?.valor ?? 0), 0);
  return { total, rows: data?.length ?? 0 };
}

/* =========================
   ✅ EXTRATO
   GET /financial/statement
========================= */

type StatementItem = {
  id?: string;
  date?: string | null; // YYYY-MM-DD
  description?: string;
  amount?: number; // + entrada / - saída (visão investidor)
  type?: "entrada" | "saida";
};

function pickMovementDateISO(row: any): string | null {
  // Prioridade: pagamento > emissão > vencimento
  return (
    (row?.dt_pagamento ? String(row.dt_pagamento) : null) ||
    (row?.dt_emissao ? String(row.dt_emissao) : null) ||
    (row?.dt_venc ? String(row.dt_venc) : null) ||
    null
  );
}

function toYmdFromIso(iso: string): string | null {
  const m = String(iso).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(iso);
  if (!isNaN(d.getTime())) return toISODateOnly(d);
  return null;
}

function inferSignedAmount(row: any): number {
  const v = Math.abs(coerceNumber(row?.valor ?? 0));

  const nat = String(row?.natureza ?? "").toLowerCase().trim();
  const tp = String(row?.tp_lancamento ?? "").toLowerCase().trim();

  // Heurística segura:
  // - se natureza/tipo indica saída/débito => negativo
  // - se indica entrada/crédito => positivo
  // (se não der pra inferir, assume positivo)
  const looksOut =
    nat.includes("d") || nat.includes("deb") || nat.includes("saida") || nat.includes("desp") ||
    tp.includes("d") || tp.includes("deb") || tp.includes("saida") || tp.includes("pag");

  const looksIn =
    nat.includes("c") || nat.includes("cred") || nat.includes("entrada") || nat.includes("rece") ||
    tp.includes("c") || tp.includes("cred") || tp.includes("entrada") || tp.includes("rec");

  if (looksOut && !looksIn) return -v;
  return v; // default: entrada
}

router.get("/financial/statement", requireAuth, async (req: Request, res: Response) => {
  try {
    const mode = String(req.query.mode ?? "30");
    const startRaw = String(req.query.start ?? "").trim();
    const endRaw = String(req.query.end ?? "").trim();

    const startD = parseISODateOnly(startRaw);
    const endD = parseISODateOnly(endRaw);

    if (!startD || !endD) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_DATE_RANGE",
        message: "Envie start e end no formato YYYY-MM-DD",
        start: startRaw,
        end: endRaw,
      });
    }

    const startYmd = toISODateOnly(startD);
    const endYmd = toISODateOnly(endD);

    const rawCpfFromToken = String((req as any)?.user?.cpf_cnpj ?? "");
    if (!rawCpfFromToken) {
      return res.status(400).json({ ok: false, error: "MISSING_CPF_IN_TOKEN" });
    }

    const omieCodes = await getOmieCodesByCpfFlexible(rawCpfFromToken);
    if (!omieCodes || omieCodes.length === 0) {
      return res.status(404).json({
        ok: false,
        error: "OMIE_PARTY_NOT_FOUND_FOR_CPF",
        cpf: rawCpfFromToken,
      });
    }

    const startIso0 = isoStartOfDay(startYmd);
    const endIso1 = isoEndOfDay(endYmd);

    // Busca movimentos no período
    // ⚠️ Como a “data do movimento” pode cair em dt_pagamento OU dt_emissao (etc),
    // fazemos OR e depois refinamos no Node usando pickMovementDateISO.
    const { data, error } = await supabaseAdmin
      .from("omie_mf_movements")
      .select("cod_mov_cc, dt_pagamento, dt_emissao, dt_venc, valor, descricao, natureza, tp_lancamento, cod_cliente, cod_categoria, cod_projeto")
      .in("cod_cliente", omieCodes)
      .or(
        [
          `dt_pagamento.gte.${startIso0}`,
          `dt_pagamento.lte.${endIso1}`,
          `dt_emissao.gte.${startIso0}`,
          `dt_emissao.lte.${endIso1}`,
          `dt_venc.gte.${startIso0}`,
          `dt_venc.lte.${endIso1}`,
        ].join(",")
      )
      .limit(5000);

    if (error) throw new Error(`Supabase omie_mf_movements error: ${error.message}`);

    const rows = Array.isArray(data) ? data : [];

    // refinamento final por data escolhida (pagamento > emissão > venc)
    const items: StatementItem[] = rows
      .map((row: any) => {
        const iso = pickMovementDateISO(row);
        const ymd = iso ? toYmdFromIso(iso) : null;
        const amountSigned = inferSignedAmount(row);

        return {
          id: row?.cod_mov_cc ? String(row.cod_mov_cc) : undefined,
          date: ymd,
          description: String(row?.descricao ?? "Movimentação").trim(),
          amount: amountSigned,
          type: amountSigned >= 0 ? "entrada" : "saida",
        };
      })
      .filter((it) => it.date && it.date >= startYmd && it.date <= endYmd)
      // mais recente primeiro
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));

    let totalIn = 0;
    let totalOut = 0;
    for (const it of items) {
      const a = coerceNumber(it.amount ?? 0);
      if (a >= 0) totalIn += a;
      else totalOut += Math.abs(a);
    }

    return res.json({
      ok: true,
      mode,
      start: startYmd,
      end: endYmd,
      items,
      totals: { in: totalIn, out: totalOut, net: totalIn - totalOut },
      debug: {
        cpfFromToken: rawCpfFromToken,
        omieCodesCount: omieCodes.length,
        fetchedRows: rows.length,
        returnedItems: items.length,
      },
    });
  } catch (e: any) {
    console.log("❌ /financial/statement error:", e?.message ?? e);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR", message: e?.message ?? String(e) });
  }
});

/* =========================
   ✅ FINANCEIRO POR OPERAÇÃO
   GET /operation-financial/:operationId
========================= */

router.get("/operation-financial/:operationId", requireAuth, async (req: Request, res: Response) => {
  try {
    const operationId = String(req.params.operationId || "").trim();
    if (!operationId || !isUuid(operationId)) {
      return res.status(400).json({ ok: false, error: "INVALID_OPERATION_ID", operationId });
    }

    const rawCpfFromToken = String((req as any)?.user?.cpf_cnpj ?? "");
    if (!rawCpfFromToken) {
      return res.status(400).json({ ok: false, error: "MISSING_CPF_IN_TOKEN" });
    }

    const roiExpectedRaw = Number(req.query.roi_expected ?? 0);
    const roiExpectedPercent = roiExpectedRaw < 1 ? roiExpectedRaw * 100 : roiExpectedRaw;

    const omieCodes = await getOmieCodesByCpfFlexible(rawCpfFromToken);
    if (omieCodes.length === 0) {
      return res.status(404).json({
        ok: false,
        error: "OMIE_PARTY_NOT_FOUND_FOR_CPF",
        cpf: rawCpfFromToken,
      });
    }

    const { data: op, error: opErr } = await supabaseAdmin
      .from("operations")
      .select("id,name")
      .eq("id", operationId)
      .single();

    if (opErr) throw new Error(`Supabase operations error: ${opErr.message}`);
    if (!op) return res.status(404).json({ ok: false, error: "OPERATION_NOT_FOUND" });

    const operationName = String(op.name ?? "").trim();
    if (!operationName) return res.status(400).json({ ok: false, error: "OPERATION_NAME_EMPTY" });

    const { data: projects, error: projErr } = await supabaseAdmin
      .from("omie_projects")
      .select("name,omie_internal_code")
      .ilike("name", `%${operationName}%`)
      .limit(20);

    if (projErr) throw new Error(`Supabase omie_projects error: ${projErr.message}`);

    const target = normName(operationName);
    const best =
      (projects ?? [])
        .map((p: any) => {
          const n = normName(p.name);
          const score = n === target ? 3 : n.includes(target) || target.includes(n) ? 2 : 1;
          return { ...p, score };
        })
        .sort((a: any, b: any) => b.score - a.score)[0] ?? null;

    if (!best?.omie_internal_code) {
      return res.status(404).json({ ok: false, error: "OMIE_PROJECT_NOT_FOUND_BY_NAME", operationName });
    }

    const projectInternalCode = String(best.omie_internal_code ?? "").trim();

    // ✅ regras que você passou
    const invested = await sumMovements({ projectInternalCode, categoryCode: "1.04.02", omieCodes });
    const realized = await sumMovements({ projectInternalCode, categoryCode: "2.10.98", omieCodes });

    const amountInvested = invested.total;
    const realizedValue = realized.total;

    const expectedProfit =
      amountInvested && roiExpectedPercent ? amountInvested * (roiExpectedPercent / 100) : 0;

    // ✅ “realizedProfit/realizedReturn = 2.10.98 dividido por 1.04.02”
    const realizedRoiPercent = amountInvested > 0 ? (realizedValue / amountInvested) * 100 : 0;

    return res.json({
      ok: true,
      operationId,
      operationName,
      projectInternalCode,
      amountInvested,
      expectedProfit,
      realizedProfit: realizedValue,
      realizedRoiPercent,
      roiExpectedPercent,
      debug: {
        cpfFromToken: rawCpfFromToken,
        omieCodes,
        investedRowsMatched: invested.rows,
        realizedRowsMatched: realized.rows,
        matchedProjectName: best?.name,
      },
    });
  } catch (e: any) {
    console.log("❌ /operation-financial error:", e?.message ?? e);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR", message: e?.message ?? String(e) });
  }
});

export default router;
