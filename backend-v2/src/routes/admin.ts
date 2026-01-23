// backend-v2/src/routes/admin.ts
// ✅ Rotas administrativas - acesso apenas para usuários com is_admin = true
// Não mexe nas rotas existentes, apenas adiciona novas rotas

import { Router, Request, Response } from "express";
import { requireAuth, requireAdmin } from "./auth";
import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";

const router = Router();

// Helper function
const norm = (v: any) => String(v ?? "").trim();

/* =========================
   ✅ Estatísticas gerais do sistema
========================= */
router.get("/admin/stats", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    // 1) Buscar todas as operações
    const { data: operations, error: opsErr } = await supabaseAdmin
      .from("operations")
      .select("id, status, name");

    if (opsErr) throw opsErr;

    const ops = operations ?? [];
    const opsEmAndamento = ops.filter((op: any) => {
      const status = norm(op.status).toLowerCase();
      return status.includes("andamento");
    });
    const opsFinalizadas = ops.filter((op: any) => {
      const status = norm(op.status).toLowerCase();
      return status.includes("final") || status.includes("conclu");
    });

    // 2) Buscar todos os projetos únicos (para calcular valores)
    const { data: projects, error: projErr } = await supabaseAdmin
      .from("omie_projects")
      .select("omie_internal_code, name");

    if (projErr) throw projErr;

    const projectCodes = (projects ?? []).map((p: any) => norm(p.omie_internal_code)).filter(Boolean);

    // 3) Buscar movimentações de investimento (1.04.02) e lucro (2.10.98) - SEM FILTRO DE CLIENTE
    const { data: movements, error: movErr } = await supabaseAdmin
      .from("omie_mf_movements")
      .select("cod_categoria, valor, cod_cliente")
      .in("cod_projeto", projectCodes.length > 0 ? projectCodes : [""]);

    if (movErr) throw movErr;

    let totalInvestido = 0;
    let totalLucroDistribuido = 0;
    const clientesComMovimento = new Set<string>();

    for (const m of movements ?? []) {
      const cat = norm(m.cod_categoria);
      const valor = Number(m.valor ?? 0);
      const cliente = norm(m.cod_cliente);

      if (cat === "1.04.02") {
        totalInvestido += Math.abs(valor);
        if (cliente) clientesComMovimento.add(cliente);
      }
      if (cat === "2.10.98") {
        totalLucroDistribuido += Math.abs(valor);
      }
    }

    logger.info("Admin: estatísticas calculadas", {
      opsTotal: ops.length,
      opsEmAndamento: opsEmAndamento.length,
      opsFinalizadas: opsFinalizadas.length,
      clientesAtivos: clientesComMovimento.size,
    });

    return res.json({
      ok: true,
      stats: {
        operacoesEmAndamento: opsEmAndamento.length,
        operacoesFinalizadas: opsFinalizadas.length,
        clientesAtivos: clientesComMovimento.size,
        valorTotalInvestido: totalInvestido,
        lucroTotalDistribuido: totalLucroDistribuido,
      },
    });
  } catch (err: any) {
    logger.error("admin/stats error", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR", message: err?.message ?? String(err) });
  }
});

/* =========================
   ✅ Todas as operações (sem filtro por CPF) - formato igual ao /operations
========================= */
router.get("/admin/operations/all", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    // 1) Buscar todas as operações
    const { data: operations, error: opsErr } = await supabaseAdmin
      .from("operations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (opsErr) throw opsErr;

    const ops = operations ?? [];
    if (!ops.length) {
      return res.json({ ok: true, operations: [], count: 0 });
    }

    // 2) Buscar projetos
    const projectNames = Array.from(new Set(ops.map((op: any) => norm(op.name)).filter(Boolean)));
    const { data: projects, error: projErr } = await supabaseAdmin
      .from("omie_projects")
      .select("name, omie_internal_code")
      .in("name", projectNames.length > 0 ? projectNames : [""]);

    if (projErr) throw projErr;

    const projectCodeByName = new Map<string, string>();
    for (const p of projects ?? []) {
      const name = norm(p.name);
      const code = norm(p.omie_internal_code);
      if (name && code) projectCodeByName.set(name, code);
    }

    // 3) Buscar movimentações (SEM FILTRO DE CLIENTE)
    const projectCodes = Array.from(projectCodeByName.values()).filter(Boolean);
    const { data: movements, error: movErr } = await supabaseAdmin
      .from("omie_mf_movements")
      .select("cod_projeto, cod_categoria, natureza, valor")
      .in("cod_projeto", projectCodes.length > 0 ? projectCodes : [""]);

    if (movErr) throw movErr;

    const investedByProject = new Map<string, number>();
    const realizedByProject = new Map<string, number>();
    const totalCostsByProject = new Map<string, number>();
    const EXCLUDE_COSTS = new Set(["2.10.98", "2.10.99"]);

    for (const m of movements ?? []) {
      const p = norm(m.cod_projeto);
      const cat = norm(m.cod_categoria);
      const nat = norm(m.natureza).toLowerCase();
      const v = Number(m.valor ?? 0) || 0;

      if (!p) continue;

      if (cat === "1.04.02") investedByProject.set(p, (investedByProject.get(p) ?? 0) + v);
      if (cat === "2.10.98") realizedByProject.set(p, (realizedByProject.get(p) ?? 0) + v);

      if (nat === "p" && cat && !EXCLUDE_COSTS.has(cat)) {
        totalCostsByProject.set(p, (totalCostsByProject.get(p) ?? 0) + v);
      }
    }

    // 4) Normalizar resposta (igual ao /operations)
    const normalized = ops.map((op: any) => {
      const statusRaw = norm(op.status).toLowerCase();
      const status =
        statusRaw.includes("andamento")
          ? "em_andamento"
          : statusRaw.includes("final") || statusRaw.includes("conclu")
          ? "concluida"
          : op.status ?? "em_andamento";

      const projCode = projectCodeByName.get(norm(op.name)) ?? "";
      const amountInvested = investedByProject.get(projCode) ?? 0;
      const realizedValue = realizedByProject.get(projCode) ?? 0;
      const totalCosts = totalCostsByProject.get(projCode) ?? 0;

      return {
        id: op.id,
        propertyName: op.name,
        name: op.name,
        city: op.city,
        state: op.state,
        status,
        roi: Number(op.expected_roi ?? 0),
        amountInvested,
        totalInvestment: amountInvested,
        realizedProfit: realizedValue,
        netProfit: realizedValue,
        totalCosts,
        estimatedTerm: op.estimated_term_months ?? "",
        realizedTerm: op.realized_term_months ?? "",
        documents: {
          cartaArrematacao: op.link_arrematacao ?? "",
          matriculaConsolidada: op.link_matricula ?? "",
          contratoScp: op.link_contrato_scp ?? "",
        },
        photoUrl: op.photo_url ?? null,
      };
    });

    logger.info("Admin: listou todas as operações", { count: normalized.length });

    return res.json({
      ok: true,
      operations: normalized,
      count: normalized.length,
    });
  } catch (err: any) {
    logger.error("admin/operations/all error", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR", message: err?.message ?? String(err) });
  }
});

/* =========================
   ✅ Todos os clientes/parties (sem filtro)
========================= */
router.get("/admin/parties/all", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { data: parties, error } = await supabaseAdmin
      .from("omie_parties")
      .select("id, name, cpf_cnpj, omie_code, email, updated_at")
      .order("name", { ascending: true })
      .limit(1000);

    if (error) throw error;

    logger.info("Admin: listou todos os clientes", { count: parties?.length ?? 0 });

    return res.json({
      ok: true,
      parties: parties ?? [],
      count: parties?.length ?? 0,
    });
  } catch (err: any) {
    logger.error("admin/parties/all error", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR", message: err?.message ?? String(err) });
  }
});

/* =========================
   ✅ Clientes com dados financeiros (valor investido e lucro)
========================= */
router.get("/admin/parties/with-financial", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    // 1) Buscar todos os clientes
    const { data: parties, error: partiesErr } = await supabaseAdmin
      .from("omie_parties")
      .select("id, name, cpf_cnpj, omie_code, email")
      .limit(1000);

    if (partiesErr) throw partiesErr;

    const partiesList = parties ?? [];
    const omieCodes = partiesList.map((p: any) => norm(p.omie_code)).filter(Boolean);

    if (omieCodes.length === 0) {
      return res.json({ ok: true, parties: [] });
    }

    // 2) Converter omie_codes para números (se possível)
    const omieCodesNum = omieCodes
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n));
    const codesForIn: any[] = omieCodesNum.length > 0 ? omieCodesNum : omieCodes;

    // 3) Buscar movimentações de investimento (1.04.02) e lucro (2.10.98) agrupadas por cliente
    const { data: movements, error: movErr } = await supabaseAdmin
      .from("omie_mf_movements")
      .select("cod_cliente, cod_categoria, valor")
      .in("cod_cliente", codesForIn);

    if (movErr) throw movErr;

    // 4) Agregar por cliente
    const financialByClient = new Map<string, { invested: number; profit: number }>();

    for (const m of movements ?? []) {
      const cliente = norm(m.cod_cliente);
      const cat = norm(m.cod_categoria);
      const valor = Math.abs(Number(m.valor ?? 0));

      if (!cliente) continue;

      const current = financialByClient.get(cliente) ?? { invested: 0, profit: 0 };

      if (cat === "1.04.02") {
        current.invested += valor;
      }
      if (cat === "2.10.98") {
        current.profit += valor;
      }

      financialByClient.set(cliente, current);
    }

    // 5) Combinar dados de parties com dados financeiros
    const partiesWithFinancial = partiesList
      .map((party: any) => {
        const omieCode = norm(party.omie_code);
        const financial = financialByClient.get(omieCode) ?? { invested: 0, profit: 0 };

        return {
          id: party.id,
          name: party.name,
          cpf_cnpj: party.cpf_cnpj,
          omie_code: party.omie_code,
          email: party.email,
          valorInvestido: financial.invested,
          lucroDistribuido: financial.profit,
        };
      })
      .filter((p: any) => p.valorInvestido > 0) // Só clientes com investimento
      .sort((a: any, b: any) => b.valorInvestido - a.valorInvestido); // Ordenar por valor investido (maior primeiro)

    logger.info("Admin: listou clientes com dados financeiros", { count: partiesWithFinancial.length });

    return res.json({
      ok: true,
      parties: partiesWithFinancial,
      count: partiesWithFinancial.length,
    });
  } catch (err: any) {
    logger.error("admin/parties/with-financial error", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR", message: err?.message ?? String(err) });
  }
});

/* =========================
   ✅ Todas as movimentações financeiras (sem filtro por CPF)
========================= */
router.get("/admin/movements/all", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 500;
    const offset = Number(req.query.offset) || 0;

    const { data: movements, error } = await supabaseAdmin
      .from("omie_mf_movements")
      .select("*")
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    logger.info("Admin: listou movimentações", { count: movements?.length ?? 0, limit, offset });

    return res.json({
      ok: true,
      movements: movements ?? [],
      count: movements?.length ?? 0,
      limit,
      offset,
    });
  } catch (err: any) {
    logger.error("admin/movements/all error", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR", message: err?.message ?? String(err) });
  }
});

/* =========================
   ✅ Definir/remover admin de um usuário
========================= */
router.post("/admin/set-admin", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const partyId = String(req.body?.party_id ?? "").trim();
    const isAdmin = Boolean(req.body?.is_admin);

    if (!partyId) {
      return res.status(400).json({ ok: false, error: "party_id é obrigatório" });
    }

    const { error } = await supabaseAdmin
      .from("party_auth")
      .update({ is_admin: isAdmin })
      .eq("party_id", partyId);

    if (error) throw error;

    logger.info("Admin: alterou is_admin", { party_id: partyId, is_admin: isAdmin });

    return res.json({
      ok: true,
      party_id: partyId,
      is_admin: isAdmin,
    });
  } catch (err: any) {
    logger.error("admin/set-admin error", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR", message: err?.message ?? String(err) });
  }
});

export default router;
