"use strict";
// backend-v2/src/routes/operation-costs.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const supabase_1 = require("../lib/supabase");
const router = (0, express_1.Router)();
function requireAuth(req, res, next) {
    try {
        const auth = req.headers.authorization || "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
        if (!token)
            return res.status(401).json({ ok: false, error: "Sem token" });
        const secret = process.env.JWT_SECRET;
        if (!secret)
            throw new Error("JWT_SECRET não configurado");
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        req.user = {
            cpf_cnpj: decoded?.cpf_cnpj,
            party_id: decoded?.party_id,
        };
        return next();
    }
    catch {
        return res.status(401).json({ ok: false, error: "Token inválido" });
    }
}
const norm = (v) => String(v ?? "").trim();
const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};
const cleanStr = (v) => {
    const s = norm(v);
    if (!s)
        return "";
    const low = s.toLowerCase();
    if (low === "null" || low === "undefined" || low === "nan")
        return "";
    return s;
};
// categorias que NÃO entram na soma
const EXCLUDED_CATEGORY_CODES = new Set(["2.10.98", "2.10.99"]);
const isNaturezaP = (m) => cleanStr(m?.natureza).toLowerCase() === "p";
// normaliza só para comparação (exclusão e fallback)
const normalizeForCompare = (v) => {
    const s = cleanStr(v);
    if (!s)
        return "";
    const only = s.replace(/[^\d.]/g, "");
    if (!only)
        return "";
    return only
        .split(".")
        .filter(Boolean)
        .map((p) => String(Number(p)))
        .join(".");
};
const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size)
        out.push(arr.slice(i, i + size));
    return out;
};
async function loadAllCategoriesMap() {
    const map = new Map();
    const PAGE = 1000;
    let from = 0;
    while (true) {
        const to = from + PAGE - 1;
        const resp = await supabase_1.supabaseAdmin
            .from("omie_categories")
            .select("omie_code, name")
            .range(from, to);
        if (resp.error) {
            console.error("❌ [operation-costs] loadAllCategoriesMap error:", resp.error);
            break;
        }
        const rows = (resp.data ?? []);
        for (const r of rows) {
            const raw = cleanStr(r.omie_code);
            if (!raw)
                continue;
            const meta = {
                name: cleanStr(r.name) || undefined,
                description: cleanStr(r.description) || undefined,
            };
            map.set(raw, meta);
            const key = normalizeForCompare(raw);
            if (key)
                map.set(key, meta);
        }
        if (rows.length < PAGE)
            break;
        from += PAGE;
    }
    return map;
}
async function loadPartiesMap(partyCodes) {
    const map = new Map();
    if (!partyCodes.length)
        return map;
    const BATCH = 500;
    for (let i = 0; i < partyCodes.length; i += BATCH) {
        const slice = partyCodes.slice(i, i + BATCH);
        const resp = await supabase_1.supabaseAdmin
            .from("omie_parties")
            .select("omie_code, name")
            .in("omie_code", slice);
        if (resp.error) {
            console.error("⚠️ [operation-costs] loadPartiesMap batch error (IGNORANDO):", resp.error);
            continue;
        }
        for (const p of (resp.data ?? [])) {
            const code = cleanStr(p.omie_code);
            const name = cleanStr(p.name);
            if (code)
                map.set(code, { name: name || code });
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
router.get("/:operationId/debug-category", requireAuth, async (req, res) => {
    const operationId = cleanStr(req.params?.operationId);
    try {
        if (!operationId) {
            return res.status(400).json({ ok: false, error: "operationId inválido" });
        }
        // 1) operation -> name
        const opResp = await supabase_1.supabaseAdmin
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
        let projResp = await supabase_1.supabaseAdmin
            .from("omie_projects")
            .select("omie_internal_code, name")
            .eq("name", opName)
            .limit(1);
        if (!projResp.error && (projResp.data?.length ?? 0) === 0) {
            projResp = await supabase_1.supabaseAdmin
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
        const movResp = await supabase_1.supabaseAdmin
            .from("omie_mf_movements")
            .select("cod_categoria, natureza, valor, cod_cliente")
            .eq("cod_projeto", codProjeto)
            .limit(30);
        if (movResp.error) {
            return res.status(500).json({ ok: false, where: "omie_mf_movements", error: movResp.error });
        }
        const rows = movResp.data ?? [];
        const sample = rows.find((r) => cleanStr(r.cod_categoria));
        const codCategoria = cleanStr(sample?.cod_categoria);
        // 4) lookup direto (o mais simples possível)
        const catResp = await supabase_1.supabaseAdmin
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
    }
    catch (e) {
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
router.get("/:operationId", requireAuth, async (req, res) => {
    const operationId = cleanStr(req.params?.operationId);
    try {
        if (!operationId) {
            return res.status(400).json({ ok: false, error: "operationId inválido" });
        }
        // 1) operation -> name
        const opResp = await supabase_1.supabaseAdmin
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
        let projResp = await supabase_1.supabaseAdmin
            .from("omie_projects")
            .select("omie_internal_code, name")
            .eq("name", opName)
            .limit(1);
        if (!projResp.error && (projResp.data?.length ?? 0) === 0) {
            projResp = await supabase_1.supabaseAdmin
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
        const movesResp = await supabase_1.supabaseAdmin
            .from("omie_mf_movements")
            .select("cod_categoria, natureza, valor, cod_cliente")
            .eq("cod_projeto", codProjeto);
        if (movesResp.error) {
            console.error("❌ [/operation-costs] omie_mf_movements error:", movesResp.error);
            return res.status(500).json({ ok: false, error: "Falha ao buscar movimentos (omie_mf_movements)" });
        }
        const costMoves = (movesResp.data ?? []).filter(isNaturezaP);
        // 4) inclui só o que NÃO está excluído
        const includedMoves = costMoves.filter((m) => {
            const rawCat = cleanStr(m.cod_categoria);
            if (!rawCat)
                return false;
            const comp = normalizeForCompare(rawCat);
            return comp && !EXCLUDED_CATEGORY_CODES.has(comp);
        });
        const totalCosts = includedMoves.reduce((acc, m) => acc + num(m.valor), 0);
        // 5) agrupar por categoria (RAW) e fornecedor
        const byCategory = new Map();
        for (const m of includedMoves) {
            const categoryCode = cleanStr(m.cod_categoria);
            if (!categoryCode)
                continue;
            const partyCode = cleanStr(m.cod_cliente) || "__SEM_FORNECEDOR__";
            const v = num(m.valor);
            const current = byCategory.get(categoryCode) ?? { total: 0, byParty: new Map() };
            current.total += v;
            current.byParty.set(partyCode, (current.byParty.get(partyCode) ?? 0) + v);
            byCategory.set(categoryCode, current);
        }
        // 6) carrega catálogo inteiro de categorias (não depende de IN)
        const categoryMap = await loadAllCategoriesMap();
        // 7) carrega parties necessárias
        const partyCodes = Array.from(new Set(includedMoves.map((m) => cleanStr(m.cod_cliente)).filter(Boolean)));
        const partyMap = await loadPartiesMap(partyCodes);
        // 8) montar resposta final
        const categories = Array.from(byCategory.entries())
            .map(([categoryCode, agg]) => {
            const meta = categoryMap.get(categoryCode) || categoryMap.get(normalizeForCompare(categoryCode));
            const categoryName = meta?.name || meta?.description || categoryCode;
            const items = Array.from(agg.byParty.entries())
                .map(([partyCode, total]) => {
                const partyName = partyCode === "__SEM_FORNECEDOR__"
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
    }
    catch (e) {
        console.error("💥 [/operation-costs] error:", e);
        return res.status(500).json({ ok: false, error: "Erro ao buscar custos" });
    }
});
exports.default = router;
