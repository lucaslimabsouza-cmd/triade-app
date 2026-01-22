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
async function sumMovements(params: { projectInternalCode: string; categoryCode: string; omieCodes: string[] }) {
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

/**
 * GET /operation-financial/:operationId
 */
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

    const { data: op, error: opErr } = await supabaseAdmin.from("operations").select("id,name").eq("id", operationId).single();
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

    const expectedProfit = amountInvested && roiExpectedPercent ? amountInvested * (roiExpectedPercent / 100) : 0;

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
