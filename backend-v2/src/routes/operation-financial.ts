// src/routes/operation-financial.ts

import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { supabaseAdmin } from "../lib/supabase";

const router = Router();

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
  const d = new Date(`${raw}T00:00:00.000Z`);
  if (isNaN(d.getTime())) return null;
  return d;
}

function coerceNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * ✅ Retorna TODOS os omie_code vinculados ao CPF/CNPJ do login
 */
async function getOmieCodesByCpf(cpfDigits: string): Promise<string[]> {
  const cpfCnpj = cpfDigits;

  const { data, error } = await supabaseAdmin
    .from("omie_parties")
    .select("omie_code, cpf_cnpj")
    .eq("cpf_cnpj", cpfCnpj);

  if (error) throw new Error(`Supabase omie_parties error: ${error.message}`);

  const codes =
    (data ?? [])
      .map((r: any) => String(r?.omie_code ?? "").trim())
      .filter((x: string) => x.length > 0) ?? [];

  return Array.from(new Set(codes));
}

/**
 * ✅ Soma movimentos do projeto filtrando por cod_cliente IN (omie_codes do CPF)
 */
async function sumMovements(params: {
  projectInternalCode: string;
  categoryCode: string;
  omieCodes: string[];
}) {
  const { projectInternalCode, categoryCode, omieCodes } = params;

  if (!omieCodes || omieCodes.length === 0) {
    return { total: 0, rows: 0 };
  }

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

/**
 * ✅ data do movimento (prioriza dt_pagamento, como você falou)
 */
function getMovementDateRaw(row: any): string | null {
  const candidates = [
    row?.dt_pagamento,      // ✅ PRINCIPAL (AAAA-MM-DD)
    row?.data_pagamento,
    row?.data,
    row?.data_lancamento,
    row?.dt_lancamento,
    row?.data_movimento,
    row?.data_emissao,
    row?.created_at,
  ]
    .map((x: any) => (x == null ? "" : String(x).trim()))
    .filter((x: string) => x.length > 0);

  if (candidates.length === 0) return null;
  return candidates[0];
}

function toDateForCompare(raw: string | null): Date | null {
  if (!raw) return null;

  const isoOnly = parseISODateOnly(raw);
  if (isoOnly) return isoOnly;

  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d;

  return null;
}

/**
 * ✅ SINAL PADRÃO (empresa): "1." entrada (+), "2." saída (-)
 * (Usado no /operation-financial e outros cálculos)
 */
function classifySignedAmountCompany(valor: number, codCategoria?: string | null) {
  const cat = String(codCategoria ?? "").trim();
  if (cat.startsWith("2.")) return -Math.abs(valor);
  if (cat.startsWith("1.")) return Math.abs(valor);
  return valor;
}

/**
 * ✅ SINAL PARA O EXTRATO DO INVESTIDOR (invertido):
 * - Do ponto de vista do investidor:
 *   - Aporte (1.04.02) = SAÍDA (negativo)
 *   - Distribuição/retorno (2.10.98 / 2.10.99 etc) = ENTRADA (positivo)
 *
 * Regra prática:
 * - "1." vira NEGATIVO
 * - "2." vira POSITIVO
 */
function classifySignedAmountInvestor(valor: number, codCategoria?: string | null) {
  const cat = String(codCategoria ?? "").trim();
  if (cat.startsWith("1.")) return -Math.abs(valor);
  if (cat.startsWith("2.")) return Math.abs(valor);
  return valor;
}

/**
 * =========================
 *  GET /operation-financial/:operationId
 *  (mantém como está)
 * =========================
 */
router.get("/operation-financial/:operationId", requireAuth, async (req: Request, res: Response) => {
  try {
    const operationId = String(req.params.operationId || "").trim();
    if (!operationId || !isUuid(operationId)) {
      return res.status(400).json({ ok: false, error: "INVALID_OPERATION_ID", operationId });
    }

    const cpfDigits = onlyDigits(String((req as any)?.user?.cpf_cnpj ?? ""));
    if (!cpfDigits) {
      return res.status(400).json({ ok: false, error: "MISSING_CPF_IN_TOKEN" });
    }

    const roiExpectedRaw = Number(req.query.roi_expected ?? 0);
    const roiExpectedPercent = roiExpectedRaw < 1 ? roiExpectedRaw * 100 : roiExpectedRaw;

    const omieCodes = await getOmieCodesByCpf(cpfDigits);
    if (omieCodes.length === 0) {
      return res.status(404).json({
        ok: false,
        error: "OMIE_PARTY_NOT_FOUND_FOR_CPF",
        cpfDigits,
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

    let best: any = null;
    let matchMode = "ilike_then_score";

    if (!projects || projects.length === 0) {
      const { data: projectsAll, error: projAllErr } = await supabaseAdmin
        .from("omie_projects")
        .select("name,omie_internal_code")
        .limit(2000);

      if (projAllErr) throw new Error(`Supabase omie_projects fallback error: ${projAllErr.message}`);

      const target = normName(operationName);
      best =
        (projectsAll ?? [])
          .map((p: any) => {
            const n = normName(p.name);
            const score = n === target ? 3 : n.includes(target) || target.includes(n) ? 2 : 0;
            return { ...p, score };
          })
          .sort((a: any, b: any) => b.score - a.score)[0] ?? null;

      matchMode = "fallback_in_memory";

      if (!best || !best.omie_internal_code) {
        return res.status(404).json({
          ok: false,
          error: "OMIE_PROJECT_NOT_FOUND_BY_NAME",
          operationName,
        });
      }
    } else {
      const target = normName(operationName);
      best =
        projects
          .map((p: any) => {
            const n = normName(p.name);
            const score = n === target ? 3 : n.includes(target) || target.includes(n) ? 2 : 1;
            return { ...p, score };
          })
          .sort((a: any, b: any) => b.score - a.score)[0] ?? null;

      if (!best || !best.omie_internal_code) {
        return res.status(500).json({ ok: false, error: "OMIE_PROJECT_INTERNAL_CODE_EMPTY", best });
      }
    }

    const projectInternalCode = String(best.omie_internal_code ?? "").trim();
    if (!projectInternalCode) {
      return res.status(500).json({ ok: false, error: "OMIE_PROJECT_INTERNAL_CODE_EMPTY", best });
    }

    const invested = await sumMovements({
      projectInternalCode,
      categoryCode: "1.04.02",
      omieCodes,
    });

    const realized = await sumMovements({
      projectInternalCode,
      categoryCode: "2.10.98",
      omieCodes,
    });

    const amountInvested = invested.total;
    const realizedProfit = realized.total;

    const expectedProfit =
      amountInvested && roiExpectedPercent ? amountInvested * (roiExpectedPercent / 100) : 0;

    const realizedRoiPercent = amountInvested > 0 ? (realizedProfit / amountInvested) * 100 : 0;

    return res.json({
      ok: true,
      operationId,
      operationName,
      projectInternalCode,
      amountInvested,
      expectedProfit,
      realizedProfit,
      realizedRoiPercent,
      roiExpectedPercent,
      debug: {
        cpfDigits,
        omieCodes,
        investedRowsMatched: invested.rows,
        realizedRowsMatched: realized.rows,
        matchedProjectName: best?.name,
        matchMode,
      },
    });
  } catch (e: any) {
    console.log("❌ /operation-financial error:", e?.message ?? e);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_ERROR",
      message: e?.message ?? String(e),
    });
  }
});

/**
 * =========================
 *  ✅ Extrato (linhas) do CPF logado (VISÃO INVESTIDOR)
 *
 *  GET /financial/statement?mode=30|90|custom&start=YYYY-MM-DD&end=YYYY-MM-DD
 * =========================
 */
async function handleFinancialStatement(req: Request, res: Response) {
  try {
    const cpfDigits = onlyDigits(String((req as any)?.user?.cpf_cnpj ?? ""));
    if (!cpfDigits) {
      return res.status(400).json({ ok: false, error: "MISSING_CPF_IN_TOKEN" });
    }

    const omieCodes = await getOmieCodesByCpf(cpfDigits);
    if (omieCodes.length === 0) {
      return res.status(404).json({
        ok: false,
        error: "OMIE_PARTY_NOT_FOUND_FOR_CPF",
        cpfDigits,
      });
    }

    const mode = String(req.query.mode ?? "30").trim(); // "30" | "90" | "custom"

    const now = new Date();
    const endD = parseISODateOnly(String(req.query.end ?? "")) ?? now;

    const computedStart =
      mode === "90"
        ? new Date(endD.getTime() - 90 * 24 * 60 * 60 * 1000)
        : new Date(endD.getTime() - 30 * 24 * 60 * 60 * 1000);

    const startD =
      (mode === "custom" ? parseISODateOnly(String(req.query.start ?? "")) : null) ??
      computedStart;

    const startIso = toISODateOnly(startD);
    const endIso = toISODateOnly(endD);

    /**
     * 1) Projetos do investidor (onde ele aportou)
     */
    const { data: investedRows, error: invErr } = await supabaseAdmin
      .from("omie_mf_movements")
      .select("cod_projeto")
      .eq("cod_categoria", "1.04.02")
      .in("cod_cliente", omieCodes);

    if (invErr) throw new Error(`Supabase omie_mf_movements invested error: ${invErr.message}`);

    const investorProjects = Array.from(
      new Set(
        (investedRows ?? [])
          .map((r: any) => String(r?.cod_projeto ?? "").trim())
          .filter((x: string) => x.length > 0)
      )
    );

    if (investorProjects.length === 0) {
      return res.json({
        ok: true,
        start: startIso,
        end: endIso,
        items: [],
        totals: { in: 0, out: 0, net: 0 },
        debug: { cpfDigits, omieCodes, investorProjectsCount: 0 },
      });
    }

    /**
     * 2) Busca movimentos (sem depender de filtro de data no SQL)
     *    - usa dt_pagamento como data principal
     */
    const { data: rows, error: movErr } = await supabaseAdmin
      .from("omie_mf_movements")
      .select("cod_projeto,cod_categoria,cod_cliente,valor,descricao,dt_pagamento")
      .in("cod_projeto", investorProjects)
      .in("cod_cliente", omieCodes)
      .limit(5000);

    if (movErr) throw new Error(`Supabase omie_mf_movements statement error: ${movErr.message}`);

    /**
     * 3) Nomes dos projetos
     */
    const { data: projRows, error: projErr } = await supabaseAdmin
      .from("omie_projects")
      .select("omie_internal_code,name")
      .in("omie_internal_code", investorProjects);

    if (projErr) throw new Error(`Supabase omie_projects statement error: ${projErr.message}`);

    const projectNameByCode = new Map<string, string>();
    (projRows ?? []).forEach((p: any) => {
      const code = String(p?.omie_internal_code ?? "").trim();
      const name = String(p?.name ?? "").trim();
      if (code) projectNameByCode.set(code, name);
    });

    // filtro de período
    const startCmp = new Date(`${startIso}T00:00:00.000Z`).getTime();
    const endCmp = new Date(`${endIso}T23:59:59.999Z`).getTime();

    const itemsRaw = (rows ?? [])
      .map((r: any) => {
        const projectCode = String(r?.cod_projeto ?? "").trim();
        const projectName = projectNameByCode.get(projectCode) ?? projectCode;

        const dateRaw = getMovementDateRaw(r); // dt_pagamento
        const dateObj = toDateForCompare(dateRaw);

        const dateOk = dateObj
          ? dateObj.getTime() >= startCmp && dateObj.getTime() <= endCmp
          : false;

        const valor = coerceNumber(r?.valor);
        const codCategoria = String(r?.cod_categoria ?? "").trim() || null;

        // ✅ IMPORTANTe: visão investidor (invertido)
        const signedAmount = classifySignedAmountInvestor(valor, codCategoria);

        const type = signedAmount < 0 ? "saida" : "entrada";

        // ✅ descrição simples (sem categoria)
        const desc =
          String(r?.descricao ?? "").trim() ||
          projectName ||
          "Movimentação";

        return {
          dateObj,
          dateRaw,
          dateOk,
          projectCode,
          projectName,
          description: desc,
          amount: signedAmount,
          type,
        };
      })
      .filter((x: any) => x.dateOk);

    // ordena desc (mais recente primeiro)
    itemsRaw.sort((a: any, b: any) => {
      const ta = a.dateObj ? a.dateObj.getTime() : 0;
      const tb = b.dateObj ? b.dateObj.getTime() : 0;
      return tb - ta;
    });

    // totals
    let totalIn = 0;
    let totalOut = 0;

    const items = itemsRaw.map((x: any, idx: number) => {
      if (x.amount < 0) totalOut += Math.abs(x.amount);
      else totalIn += x.amount;

      return {
        id: `${x.projectCode}:${idx}:${x.dateRaw ?? "nodate"}`,
        date: x.dateObj ? toISODateOnly(x.dateObj) : null,
        dateTimeRaw: x.dateRaw,
        description: x.description,
        amount: x.amount,
        type: x.type,
        projectInternalCode: x.projectCode,
        projectName: x.projectName,
      };
    });

    const net = totalIn - totalOut;

    return res.json({
      ok: true,
      start: startIso,
      end: endIso,
      items,
      totals: { in: totalIn, out: totalOut, net },
      debug: {
        cpfDigits,
        omieCodes,
        investorProjectsCount: investorProjects.length,
        rowsFetched: (rows ?? []).length,
        itemsReturned: items.length,
      },
    });
  } catch (e: any) {
    console.log("❌ /financial/statement error:", e?.message ?? e);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_ERROR",
      message: e?.message ?? String(e),
    });
  }
}

router.get("/financial/statement", requireAuth, handleFinancialStatement);
router.get("/statement", requireAuth, handleFinancialStatement);

export default router;
