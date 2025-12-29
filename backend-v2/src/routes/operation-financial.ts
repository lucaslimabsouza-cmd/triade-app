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

/**
 * ✅ Retorna TODOS os omie_code vinculados ao CPF/CNPJ do login
 * (caso exista mais de um registro/variação)
 */
async function getOmieCodesByCpf(cpfDigits: string): Promise<string[]> {
  const cpfCnpj = cpfDigits; // já só dígitos

  const { data, error } = await supabaseAdmin
    .from("omie_parties")
    .select("omie_code, cpf_cnpj")
    .eq("cpf_cnpj", cpfCnpj);

  if (error) throw new Error(`Supabase omie_parties error: ${error.message}`);

  const codes =
    (data ?? [])
      .map((r: any) => String(r?.omie_code ?? "").trim())
      .filter((x: string) => x.length > 0) ?? [];

  // remove duplicados
  return Array.from(new Set(codes));
}

/**
 * ✅ Soma movimentos do projeto filtrando por cod_cliente IN (omie_codes do CPF)
 *
 * Regras:
 * - omie_mf_movements.cod_projeto = omie_projects.omie_internal_code
 * - omie_mf_movements.cod_cliente = omie_parties.omie_code
 */
async function sumMovements(params: {
  projectInternalCode: string; // omie_projects.omie_internal_code
  categoryCode: string; // '1.04.02' ou '2.10.98'
  omieCodes: string[]; // omie_parties.omie_code(s) do CPF logado
}) {
  const { projectInternalCode, categoryCode, omieCodes } = params;

  if (!omieCodes || omieCodes.length === 0) {
    return { total: 0, rows: 0 };
  }

  // ✅ consulta já filtrando no banco (rápido)
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

router.get("/operation-financial/:operationId", requireAuth, async (req: Request, res: Response) => {
  try {
    const operationId = String(req.params.operationId || "").trim();
    if (!operationId || !isUuid(operationId)) {
      return res.status(400).json({ ok: false, error: "INVALID_OPERATION_ID", operationId });
    }

    // ✅ CPF do login vem do token
    const cpfDigits = onlyDigits(String((req as any)?.user?.cpf_cnpj ?? ""));
    if (!cpfDigits) {
      return res.status(400).json({ ok: false, error: "MISSING_CPF_IN_TOKEN" });
    }

    const roiExpectedRaw = Number(req.query.roi_expected ?? 0);
    const roiExpectedPercent = roiExpectedRaw < 1 ? roiExpectedRaw * 100 : roiExpectedRaw;

    // 0) omie_codes do CPF
    const omieCodes = await getOmieCodesByCpf(cpfDigits);
    if (omieCodes.length === 0) {
      return res.status(404).json({
        ok: false,
        error: "OMIE_PARTY_NOT_FOUND_FOR_CPF",
        cpfDigits,
      });
    }

    // 1) Buscar operação (pegar name)
    const { data: op, error: opErr } = await supabaseAdmin
      .from("operations")
      .select("id,name")
      .eq("id", operationId)
      .single();

    if (opErr) throw new Error(`Supabase operations error: ${opErr.message}`);
    if (!op) return res.status(404).json({ ok: false, error: "OPERATION_NOT_FOUND" });

    const operationName = String(op.name ?? "").trim();
    if (!operationName) return res.status(400).json({ ok: false, error: "OPERATION_NAME_EMPTY" });

    // 2) Encontrar projeto Omie pelo nome
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

    // ✅ Este código é o cod_projeto dos movimentos
    const projectInternalCode = String(best.omie_internal_code ?? "").trim();
    if (!projectInternalCode) {
      return res.status(500).json({ ok: false, error: "OMIE_PROJECT_INTERNAL_CODE_EMPTY", best });
    }

    // 3) Soma movimentos filtrando por omieCodes (CPF)
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
      amountInvested && roiExpectedPercent
        ? amountInvested * (roiExpectedPercent / 100)
        : 0;

    const realizedRoiPercent =
      amountInvested > 0 ? (realizedProfit / amountInvested) * 100 : 0;

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

export default router;
