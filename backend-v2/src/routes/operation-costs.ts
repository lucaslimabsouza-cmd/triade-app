// backend-v2/src/routes/operation-costs.ts

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

    if (!token) return res.status(401).json({ ok: false, error: "Sem token" });

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
const num = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const cleanStr = (v: any) => {
  const s = norm(v);
  if (!s) return "";
  const low = s.toLowerCase();
  if (low === "null" || low === "undefined" || low === "nan") return "";
  return s;
};

// categorias que NÃO entram na soma
const EXCLUDED_CATEGORY_CODES = new Set(["2.10.98", "2.10.99"]);
const isNaturezaP = (m: any) => cleanStr(m?.natureza).toLowerCase() === "p";

// normaliza só para comparação (exclusão e fallback)
const normalizeForCompare = (v: any) => {
  const s = cleanStr(v);
  if (!s) return "";
  const only = s.replace(/[^\d.]/g, "");
  if (!only) return "";
  return only
    .split(".")
    .filter(Boolean)
    .map((p) => String(Number(p)))
    .join(".");
};

const chunk = <T,>(arr: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

type CatMeta = { name?: string; description?: string };
type PartyMeta = { name: string };

async function loadAllCategoriesMap(): Promise<Map<string, CatMeta>> {
  const map = new Map<string, CatMeta>();

  const PAGE = 1000;
  let from = 0;

  while (true) {
    const to = from + PAGE - 1;

    const resp = await supabaseAdmin
      .from("omie_categories")
      .select("omie_code, name")
      .range(from, to);

    if (resp.error) {
      console.error("❌ [operation-costs] loadAllCategoriesMap error:", resp.error);
      break;
    }

    const rows = (resp.data ?? []) as any[];
    for (const r of rows) {
      const raw = cleanStr(r.omie_code);
      if (!raw) continue;

      const meta: CatMeta = {
        name: cleanStr(r.name) || undefined,
        description: cleanStr(r.description) || undefined,
      };

      map.set(raw, meta);

      const key = normalizeForCompare(raw);
      if (key) map.set(key, meta);
    }

    if (rows.length < PAGE) break;
    from += PAGE;
  }

  return map;
}

async function loadPartiesMap(partyCodes: string[]): Promise<Map<string, PartyMeta>> {
  const map = new Map<string, PartyMeta>();
  if (!partyCodes.length) return map;

  const BATCH = 500;
  for (let i = 0; i < partyCodes.length; i += BATCH) {
    const slice = partyCodes.slice(i, i + BATCH);

    const resp = await supabaseAdmin
      .from("omie_parties")
      .select("omie_code, name")
      .in("omie_code", slice);

    if (resp.error) {
      console.error("⚠️ [operation-costs] loadPartiesMap batch error (IGNORANDO):", resp.error);
      continue;
    }

    for (const p of (resp.data ?? []) as any[]) {
      const code = cleanStr(p.omie_code);
      const name = cleanStr(p.name);
      if (code) map.set(code, { name: name || code });
    }
  }

  return map;
}

/**
 * DEBUG TEMPORÁRIO
 * GET /operation-costs/:operationId/debug-category
 *
 * Mostra:
 * - opName
 * - codProjeto
 * - sampleMovement (com cod_categoria)
 * - lookup direto: omie_categories.omie_code == cod_categoria
 */
router.get("/:operationId/debug-category", requireAuth, async (req: any, res) => {
  const operationId = cleanStr(req.params?.operationId);

  try {
    if (!operationId) {
      return res.status(400).json({ ok: false, error: "operationId inválido" });
    }

    // 1) operation -> name
    const opResp = await supabaseAdmin
      .from("operations")
      .select("id, name")
      .eq("id", operationId)
      .maybeSingle();

    if (opResp.error) {
      return res.status(500).json({ ok: false, where: "operations", error: opResp.error });
    }

    const opName = cleanStr(opResp.data?.name);
    if (!opName) {
      return res.status(404).json({ ok: false, error: "Operação não encontrada" });
    }

    // 2) name -> cod_projeto
    let projResp = await supabaseAdmin
      .from("omie_projects")
      .select("omie_internal_code, name")
      .eq("name", opName)
      .limit(1);

    if (!projResp.error && (projResp.data?.length ?? 0) === 0) {
      projResp = await supabaseAdmin
        .from("omie_projects")
        .select("omie_internal_code, name")
        .ilike("name", opName)
        .limit(1);
    }

    if (projResp.error) {
      return res.status(500).json({ ok: false, where: "omie_projects", error: projResp.error });
    }

    const codProjeto = cleanStr(projResp.data?.[0]?.omie_internal_code);
    if (!codProjeto) {
      return res.status(200).json({ ok: true, opName, hint: "Sem codProjeto para esse name" });
    }

    // 3) pega alguns movimentos e escolhe um com cod_categoria
    const movResp = await supabaseAdmin
      .from("omie_mf_movements")
      .select("cod_categoria, natureza, valor, cod_cliente")
      .eq("cod_projeto", codProjeto)
      .limit(30);

    if (movResp.error) {
      return res.status(500).json({ ok: false, where: "omie_mf_movements", error: movResp.error });
    }

    const rows = movResp.data ?? [];
    const sample = rows.find((r: any) => cleanStr(r.cod_categoria));

    const codCategoria = cleanStr(sample?.cod_categoria);

    // 4) lookup direto (o mais simples possível)
    const catResp = await supabaseAdmin
      .from("omie_categories")
      .select("omie_code, name")
      .eq("omie_code", codCategoria)
      .maybeSingle();

    return res.status(200).json({
      ok: true,
      opName,
      codProjeto,
      sampleMovement: sample ?? null,
      codCategoria: codCategoria || null,
      categoryLookup: {
        data: catResp.data ?? null,
        error: catResp.error ?? null,
      },
    });
  } catch (e: any) {
    console.error("💥 [/operation-costs debug-category] error:", e);
    return res.status(500).json({ ok: false, error: "Erro no debug-category" });
  }
});

/**
 * GET /operation-costs/:operationId
 *
 * - custos = omie_mf_movements onde natureza == "p"
 * - exclui categorias 2.10.98 e 2.10.99
 * - categoria: cod_categoria -> omie_categories.omie_code -> name
 * - fornecedor: cod_cliente -> omie_parties.omie_code -> name
 */
router.get("/:operationId", requireAuth, async (req: any, res) => {
  const operationId = cleanStr(req.params?.operationId);

  try {
    if (!operationId) {
      return res.status(400).json({ ok: false, error: "operationId inválido" });
    }

    // 1) operation -> name
    const opResp = await supabaseAdmin
      .from("operations")
      .select("id, name")
      .eq("id", operationId)
      .maybeSingle();

    if (opResp.error) {
      console.error("❌ [/operation-costs] operations error:", opResp.error);
      return res.status(500).json({ ok: false, error: "Falha ao buscar operação (operations)" });
    }

    const opName = cleanStr(opResp.data?.name);
    if (!opName) {
      return res.status(404).json({ ok: false, error: "Operação não encontrada" });
    }

    // 2) name -> cod_projeto
    let projResp = await supabaseAdmin
      .from("omie_projects")
      .select("omie_internal_code, name")
      .eq("name", opName)
      .limit(1);

    if (!projResp.error && (projResp.data?.length ?? 0) === 0) {
      projResp = await supabaseAdmin
        .from("omie_projects")
        .select("omie_internal_code, name")
        .ilike("name", opName)
        .limit(1);
    }

    if (projResp.error) {
      console.error("❌ [/operation-costs] omie_projects error:", projResp.error);
      return res.status(500).json({ ok: false, error: "Falha ao buscar projeto (omie_projects)" });
    }

    const codProjeto = cleanStr(projResp.data?.[0]?.omie_internal_code);
    if (!codProjeto) {
      return res.status(200).json({ totalCosts: 0, categories: [] });
    }

    // 3) movimentos do projeto
    const movesResp = await supabaseAdmin
      .from("omie_mf_movements")
      .select("cod_categoria, natureza, valor, cod_cliente")
      .eq("cod_projeto", codProjeto);

    if (movesResp.error) {
      console.error("❌ [/operation-costs] omie_mf_movements error:", movesResp.error);
      return res.status(500).json({ ok: false, error: "Falha ao buscar movimentos (omie_mf_movements)" });
    }

    const costMoves = (movesResp.data ?? []).filter(isNaturezaP);

    // 4) inclui só o que NÃO está excluído
    const includedMoves = costMoves.filter((m: any) => {
      const rawCat = cleanStr(m.cod_categoria);
      if (!rawCat) return false;

      const comp = normalizeForCompare(rawCat);
      return comp && !EXCLUDED_CATEGORY_CODES.has(comp);
    });

    const totalCosts = includedMoves.reduce((acc: number, m: any) => acc + num(m.valor), 0);

    // 5) agrupar por categoria (RAW) e fornecedor
    const byCategory = new Map<string, { total: number; byParty: Map<string, number> }>();

    for (const m of includedMoves) {
      const categoryCode = cleanStr(m.cod_categoria);
      if (!categoryCode) continue;

      const partyCode = cleanStr(m.cod_cliente) || "__SEM_FORNECEDOR__";
      const v = num(m.valor);

      const current =
        byCategory.get(categoryCode) ?? { total: 0, byParty: new Map<string, number>() };

      current.total += v;
      current.byParty.set(partyCode, (current.byParty.get(partyCode) ?? 0) + v);

      byCategory.set(categoryCode, current);
    }

    // 6) carrega catálogo inteiro de categorias (não depende de IN)
    const categoryMap = await loadAllCategoriesMap();

    // 7) carrega parties necessárias
    const partyCodes = Array.from(
      new Set(includedMoves.map((m: any) => cleanStr(m.cod_cliente)).filter(Boolean))
    );
    const partyMap = await loadPartiesMap(partyCodes);

    // 8) montar resposta final
    const categories = Array.from(byCategory.entries())
      .map(([categoryCode, agg]) => {
        const meta =
          categoryMap.get(categoryCode) || categoryMap.get(normalizeForCompare(categoryCode));

        const categoryName = meta?.name || meta?.description || categoryCode;

        const items = Array.from(agg.byParty.entries())
          .map(([partyCode, total]) => {
            const partyName =
              partyCode === "__SEM_FORNECEDOR__"
                ? "Sem fornecedor"
                : partyMap.get(partyCode)?.name ?? partyCode;

            return { partyCode, partyName, total };
          })
          .sort((a, b) => b.total - a.total);

        return {
          categoryCode,
          categoryName,
          total: agg.total,
          items,
        };
      })
      .sort((a, b) => b.total - a.total);

    return res.status(200).json({
      totalCosts,
      categories,
    });
  } catch (e: any) {
    console.error("💥 [/operation-costs] error:", e);
    return res.status(500).json({ ok: false, error: "Erro ao buscar custos" });
  }
});

export default router;
