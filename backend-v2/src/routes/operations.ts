import { Router } from "express";
import jwt from "jsonwebtoken";
import { supabaseAdmin } from "../lib/supabase";

const router = Router();

type JwtPayload = {
  party_id?: string;
  cpf_cnpj?: string;
};

function requireAuth(req: any, res: any, next: any) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    if (!token) {
      return res.status(401).json({ ok: false, error: "Sem token" });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET não configurado");

    const decoded = jwt.verify(token, secret) as JwtPayload;

    req.user = {
      cpf_cnpj: decoded?.cpf_cnpj,
      party_id: decoded?.party_id,
    };

    return next();
  } catch {
    return res.status(401).json({ ok: false, error: "Token inválido" });
  }
}

const norm = (v: any) => String(v ?? "").trim();

/**
 * GET /operations
 * - Filtra operações baseado no CPF/CNPJ do token.
 * - Regra de ligação:
 *    token.cpf_cnpj -> omie_parties.cpf_cnpj => pega omie_code
 *    omie_mf_movements.cod_cliente == omie_code => pega cod_projeto
 *    omie_projects.omie_internal_code in cod_projeto => pega name
 *    operations.name in projectNames => retorna operações
 */
router.get("/", requireAuth, async (req: any, res) => {
  const cpfCnpj = norm(req.user?.cpf_cnpj);

  console.log("🧩 [/operations] cpf_cnpj(token) =", cpfCnpj);

  try {
    if (!cpfCnpj) {
      return res
        .status(400)
        .json({ ok: false, error: "cpf_cnpj ausente no token" });
    }

    // 1) Buscar party pelo CPF/CNPJ pra pegar omie_code
    const partyResp = await supabaseAdmin
      .from("omie_parties")
      .select("id, name, cpf_cnpj, omie_code")
      .eq("cpf_cnpj", cpfCnpj)
      .maybeSingle();

    if (partyResp.error) {
      console.error("❌ [/operations] omie_parties error:", partyResp.error);
      return res
        .status(500)
        .json({ ok: false, error: "Falha ao buscar party (omie_parties)" });
    }

    const party = partyResp.data;
    console.log("🧩 [/operations] party =", party);

    if (!party?.omie_code) {
      return res.status(200).json([]);
    }

    const omieCode = norm(party.omie_code);

    // 2) Movimentos do cliente -> pegar cod_projeto (distinct)
    const movesResp = await supabaseAdmin
      .from("omie_mf_movements")
      .select("cod_projeto")
      .eq("cod_cliente", omieCode);

    if (movesResp.error) {
      console.error("❌ [/operations] omie_mf_movements error:", movesResp.error);
      return res.status(500).json({
        ok: false,
        error: "Falha ao buscar movimentos (omie_mf_movements)",
      });
    }

    const projectCodes = Array.from(
      new Set(
        (movesResp.data ?? [])
          .map((m: any) => norm(m.cod_projeto))
          .filter(Boolean)
      )
    );

    console.log("🧩 [/operations] projectCodes =", projectCodes);

    if (projectCodes.length === 0) {
      return res.status(200).json([]);
    }

    // 3) Projetos -> pegar nome
    const projResp = await supabaseAdmin
      .from("omie_projects")
      .select("omie_internal_code, name")
      .in("omie_internal_code", projectCodes);

    if (projResp.error) {
      console.error("❌ [/operations] omie_projects error:", projResp.error);
      return res
        .status(500)
        .json({ ok: false, error: "Falha ao buscar projetos (omie_projects)" });
    }

    const projectNames = Array.from(
      new Set(
        (projResp.data ?? [])
          .map((p: any) => norm(p.name))
          .filter(Boolean)
      )
    );

    console.log("🧩 [/operations] projectNames =", projectNames);

    if (projectNames.length === 0) {
      return res.status(200).json([]);
    }

    // 4) Operações (planilha) -> filtra por name
    const opsResp = await supabaseAdmin
      .from("operations")
      .select("*")
      .in("name", projectNames);

    if (opsResp.error) {
      console.error("❌ [/operations] operations error:", opsResp.error);
      return res
        .status(500)
        .json({ ok: false, error: "Falha ao buscar operações (operations)" });
    }

    const ops = opsResp.data ?? [];

    // ✅ DEBUG: confirmar se o Supabase está trazendo link_contrato_scp
    // (isso aqui é o teste mais rápido e certeiro)
    console.log(
      "🧾 [/operations] links contrato scp:",
      ops.map((o: any) => ({
        name: o?.name,
        link_contrato_scp: o?.link_contrato_scp,
      }))
    );

    // 5) Normalizar resposta pro app
    const normalized = ops.map((op: any) => {
      const statusRaw = norm(op.status).toLowerCase();

      const status =
        statusRaw.includes("andamento")
          ? "em_andamento"
          : statusRaw.includes("final") || statusRaw.includes("conclu")
          ? "concluida"
          : op.status ?? "em_andamento";

      return {
        id: op.id,
        propertyName: op.name,
        city: op.city,
        state: op.state,
        status,

        amountInvested: 0,

        roi: op.expected_roi ?? op.roi ?? 0,
        realizedProfit: op.realized_profit ?? 0,

        // Este campo é o que está no Excel/planilha.
        // Custos Omie ficam na rota separada /operation-costs
        totalCosts: op.total_costs ?? 0,

        estimatedTerm: op.estimated_term_months ?? "",
        realizedTerm: op.realized_term_months ?? "",

        documents: {
          cartaArrematacao: op.link_arrematacao ?? "",
          matriculaConsolidada: op.link_matricula ?? "",
          // ✅ NOVO: Contrato SCP
          contratoScp: op.link_contrato_scp ?? "",
        },

        // TIMELINE DATES (vêm da tabela operations)
        auction_date: op.auction_date ?? null,
        itbi_date: op.itbi_date ?? null,
        deed_date: op.deed_date ?? null,
        registry_date: op.registry_date ?? null,
        vacancy_date: op.vacancy_date ?? null,
        construction_date: op.construction_date ?? null,
        listed_to_broker_date: op.listed_to_broker_date ?? null,
        sale_contract_date: op.sale_contract_date ?? null,
        sale_receipt_date: op.sale_receipt_date ?? null,
      };
    });

    return res.status(200).json(normalized);
  } catch (e: any) {
    console.error("💥 [/operations] UNHANDLED ERROR:", e);
    return res
      .status(500)
      .json({ ok: false, error: "Erro ao buscar operações" });
  }
});

export default router;
