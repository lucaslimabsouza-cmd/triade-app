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

// normaliza só para COMPARAR (exclusão e fallback de match)
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

type CatMeta = { name?: string; description?: string };

// ✅ Carrega TODAS as categorias do omie_categories (paginado) e cria map
async function loadAllCategoriesMap(): Promise<Map<string, CatMeta>> {
  const map = new Map<string, CatMeta>();

  const PAGE = 1000;
  let from = 0;

  while (true) {
    const to = from + PAGE - 1;

    const resp = await supabaseAdmin
      .from("omie_categories")
      .select("omie_code, name, description")
      .range(from, to);

    if (resp.error) {
      console.error("❌ [operation-costs] loadAllCategoriesMap error:", resp.error);
      break; // não derruba a rota; só vai ficar sem nomes
    }

    const rows = (resp.data ?? []) as any[];
    for (const r of rows) {
      const raw = cleanStr(r.omie_code);
      if (!raw) continue;

      const meta: CatMeta = {
        name: cleanStr(r.name) || undefined,
        description: cleanStr(r.description) || undefined,
      };

      // grava pelo raw
      map.set(raw, meta);

      // grava também pelo normalizado (pra casar "2.10.01" x "2.10.1")
      const key = normalizeForCompare(raw);
      if (key) map.set(key, meta);
    }

    // acabou (última página)
    if (rows.length < PAGE) break;

    from += PAGE;
  }

  return map;
}

type PartyMeta = { name: string };

// ✅ Carrega parties necessárias (paginado por IN em lotes)
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

    // ✅ 6) carrega TODAS as categorias e faz lookup local (sem .in)
    const categoryMap = await loadAllCategoriesMap();

    // 7) carrega parties necessárias
    const partyCodes = Array.from(
      new Set(includedMoves.map((m: any) => cleanStr(m.cod_cliente)).filter(Boolean))
    );

    const partyMap = await loadPartiesMap(partyCodes);

    // 8) montar resposta final
    const categories = Array.from(byCategory.entries())
      .map(([categoryCode, agg]) => {
        // tenta match RAW, e se não achar tenta match normalizado
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
