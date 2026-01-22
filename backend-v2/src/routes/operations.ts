import { Router } from "express";
import jwt from "jsonwebtoken";
import { supabaseAdmin } from "../lib/supabase";

const router = Router();

type JwtPayload = { party_id?: string; cpf_cnpj?: string };

function requireAuth(req: any, res: any, next: any) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ ok: false, error: "Sem token" });

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET não configurado");

    const decoded = jwt.verify(token, secret) as JwtPayload;

    req.user = { cpf_cnpj: decoded?.cpf_cnpj, party_id: decoded?.party_id };
    return next();
  } catch {
    return res.status(401).json({ ok: false, error: "Token inválido" });
  }
}

const norm = (v: any) => String(v ?? "").trim();
const onlyDigits = (v: any) => String(v ?? "").replace(/\D/g, "");

async function getOmieCodesByCpfFlexible(rawCpfFromToken: string): Promise<string[]> {
  const rawCpf = norm(rawCpfFromToken);
  const cpfDigits = onlyDigits(rawCpf);

  const { data, error } = await supabaseAdmin
    .from("omie_parties")
    .select("omie_code, cpf_cnpj")
    .or(`cpf_cnpj.eq.${rawCpf},cpf_cnpj.eq.${cpfDigits},cpf_cnpj.ilike.%${cpfDigits}%`);

  if (error) throw error;

  const codes = (data ?? []).map((r: any) => norm(r.omie_code)).filter(Boolean);
  return Array.from(new Set(codes));
}

router.get("/", requireAuth, async (req: any, res) => {
  const cpfCnpjFromToken = norm(req.user?.cpf_cnpj);
  console.log("🧩 [/operations] cpf_cnpj(token) =", cpfCnpjFromToken);

  try {
    if (!cpfCnpjFromToken) return res.status(400).json({ ok: false, error: "cpf_cnpj ausente no token" });

    // 1) omieCodes do investidor (pode ter mais de um)
    const omieCodes = await getOmieCodesByCpfFlexible(cpfCnpjFromToken);
    console.log("🧩 [/operations] omieCodes =", omieCodes);
    if (!omieCodes.length) return res.status(200).json([]);

    // 2) projetos do investidor: vem do mf_movements (distinct cod_projeto) filtrando cod_cliente IN omieCodes
    const movesProjectsResp = await supabaseAdmin
      .from("omie_mf_movements")
      .select("cod_projeto")
      .in("cod_cliente", omieCodes);

    if (movesProjectsResp.error) {
      console.error("❌ [/operations] omie_mf_movements error:", movesProjectsResp.error);
      return res.status(500).json({ ok: false, error: "Falha ao buscar movimentos (omie_mf_movements)" });
    }

    const projectCodes = Array.from(
      new Set((movesProjectsResp.data ?? []).map((m: any) => norm(m.cod_projeto)).filter(Boolean))
    );
    console.log("🧩 [/operations] projectCodes =", projectCodes);
    if (!projectCodes.length) return res.status(200).json([]);

    // 3) projetos -> nomes
    const projResp = await supabaseAdmin
      .from("omie_projects")
      .select("omie_internal_code, name")
      .in("omie_internal_code", projectCodes);

    if (projResp.error) {
      console.error("❌ [/operations] omie_projects error:", projResp.error);
      return res.status(500).json({ ok: false, error: "Falha ao buscar projetos (omie_projects)" });
    }

    const projectNameByCode = new Map<string, string>();
    const projectCodeByName = new Map<string, string>();
    for (const p of projResp.data ?? []) {
      const code = norm(p.omie_internal_code);
      const name = norm(p.name);
      if (code && name) {
        projectNameByCode.set(code, name);
        projectCodeByName.set(name, code);
      }
    }

    const projectNames = Array.from(new Set(Array.from(projectNameByCode.values()).filter(Boolean)));
    console.log("🧩 [/operations] projectNames =", projectNames);
    if (!projectNames.length) return res.status(200).json([]);

    // 4) operações (planilha) -> filtra por name
    const opsResp = await supabaseAdmin.from("operations").select("*").in("name", projectNames);
    if (opsResp.error) {
      console.error("❌ [/operations] operations error:", opsResp.error);
      return res.status(500).json({ ok: false, error: "Falha ao buscar operações (operations)" });
    }

    const ops = opsResp.data ?? [];
    if (!ops.length) return res.status(200).json([]);

    // 5) Agregar valores do Omie por projeto (em lote)
    const opProjectCodes = Array.from(
      new Set(ops.map((op: any) => projectCodeByName.get(norm(op.name))).filter(Boolean) as string[])
    );

    const mfResp = await supabaseAdmin
      .from("omie_mf_movements")
      .select("cod_projeto,cod_categoria,natureza,valor,cod_cliente")
      .in("cod_projeto", opProjectCodes)
      .in("cod_cliente", omieCodes);

    if (mfResp.error) {
      console.error("❌ [/operations] mf aggregate error:", mfResp.error);
      return res.status(500).json({ ok: false, error: "Falha ao agregar movimentos (omie_mf_movements)" });
    }

    const investedByProject = new Map<string, number>(); // 1.04.02
    const realizedByProject = new Map<string, number>(); // 2.10.98
    const totalCostsByProject = new Map<string, number>(); // natureza p, exclui 2.10.98 e 2.10.99

    const EXCLUDE_COSTS = new Set(["2.10.98", "2.10.99"]);

    for (const r of mfResp.data ?? []) {
      const p = norm(r.cod_projeto);
      const cat = norm(r.cod_categoria);
      const nat = norm(r.natureza).toLowerCase();
      const v = Number(r.valor ?? 0) || 0;

      if (!p) continue;

      if (cat === "1.04.02") investedByProject.set(p, (investedByProject.get(p) ?? 0) + v);
      if (cat === "2.10.98") realizedByProject.set(p, (realizedByProject.get(p) ?? 0) + v);

      if (nat === "p" && cat && !EXCLUDE_COSTS.has(cat)) {
        totalCostsByProject.set(p, (totalCostsByProject.get(p) ?? 0) + v);
      }
    }

    // 6) Normalizar resposta pro app
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
        city: op.city,
        state: op.state,
        status,

        roi: Number(op.expected_roi ?? 0),

        // ✅ agora vem do Omie (não fica zerado)
        amountInvested,
        realizedProfit: realizedValue,
        totalCosts,

        estimatedTerm: op.estimated_term_months ?? "",
        realizedTerm: op.realized_term_months ?? "",

        documents: {
          cartaArrematacao: op.link_arrematacao ?? "",
          matriculaConsolidada: op.link_matricula ?? "",
          contratoScp: op.link_contrato_scp ?? "",
        },

        photoUrl: op.photo_url ?? null,

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
    return res.status(500).json({ ok: false, error: "Erro ao buscar operações" });
  }
});

export default router;
