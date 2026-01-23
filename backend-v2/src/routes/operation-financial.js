"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// backend-v2/src/routes/operation-financial.ts
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const supabase_1 = require("../lib/supabase");
const router = (0, express_1.Router)();
/* =========================
   Utils
========================= */
function onlyDigits(s = "") {
    return String(s).replace(/\D/g, "");
}
function requireAuth(req, res, next) {
    try {
        const auth = req.headers.authorization || "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
        if (!token)
            return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
        const secret = process.env.JWT_SECRET;
        if (!secret)
            return res.status(500).json({ ok: false, error: "JWT_SECRET_MISSING" });
        const payload = jsonwebtoken_1.default.verify(token, secret);
        req.user = payload;
        next();
    }
    catch {
        return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }
}
function isUuid(u) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(u);
}
function normName(s) {
    return String(s ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ");
}
function toISODateOnly(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}
function parseISODateOnly(s) {
    const raw = String(s ?? "").trim();
    if (!raw)
        return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw))
        return null;
    const d = new Date(`${raw}T00:00:00.000Z`);
    if (isNaN(d.getTime()))
        return null;
    return d;
}
function coerceNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}
function isoStartOfDay(ymd) {
    return `${ymd}T00:00:00.000Z`;
}
function isoEndOfDay(ymd) {
    return `${ymd}T23:59:59.999Z`;
}
/** ✅ Busca omieCodes com/sem pontuação */
async function getOmieCodesByCpfFlexible(rawCpfFromToken) {
    const rawCpf = String(rawCpfFromToken ?? "").trim();
    const cpfDigits = onlyDigits(rawCpf);
    const { data, error } = await supabase_1.supabaseAdmin
        .from("omie_parties")
        .select("omie_code, cpf_cnpj")
        .or(`cpf_cnpj.eq.${rawCpf},cpf_cnpj.eq.${cpfDigits},cpf_cnpj.ilike.%${cpfDigits}%`);
    if (error)
        throw new Error(`Supabase omie_parties error: ${error.message}`);
    const codes = (data ?? [])
        .map((r) => String(r?.omie_code ?? "").trim())
        .filter((x) => x.length > 0) ?? [];
    return Array.from(new Set(codes));
}
/** ✅ Soma por projeto + categoria + cod_cliente IN (omieCodes) */
async function sumMovements(params) {
    const { projectInternalCode, categoryCode, omieCodes } = params;
    if (!omieCodes || omieCodes.length === 0)
        return { total: 0, rows: 0 };
    const omieCodesNum = omieCodes
        .map((x) => Number(String(x).trim()))
        .filter((n) => Number.isFinite(n));
    const codesForIn = omieCodesNum.length ? omieCodesNum : omieCodes;
    const { data, error } = await supabase_1.supabaseAdmin
        .from("omie_mf_movements")
        .select("valor")
        .eq("cod_projeto", projectInternalCode)
        .eq("cod_categoria", categoryCode)
        .in("cod_cliente", codesForIn);
    if (error)
        throw new Error(`Supabase omie_mf_movements error: ${error.message}`);
    const total = (data ?? []).reduce((acc, row) => acc + Number(row?.valor ?? 0), 0);
    return { total, rows: data?.length ?? 0 };
}
function pickMovementDateISO(row) {
    // Prioridade: pagamento > emissão > vencimento
    return ((row?.dt_pagamento ? String(row.dt_pagamento) : null) ||
        (row?.dt_emissao ? String(row.dt_emissao) : null) ||
        (row?.dt_venc ? String(row.dt_venc) : null) ||
        null);
}
function toYmdFromIso(iso) {
    const m = String(iso).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m)
        return `${m[1]}-${m[2]}-${m[3]}`;
    const d = new Date(iso);
    if (!isNaN(d.getTime()))
        return toISODateOnly(d);
    return null;
}
function inferSignedAmount(row) {
    const v = Math.abs(coerceNumber(row?.valor ?? 0));
    const nat = String(row?.natureza ?? "").toLowerCase().trim();
    const tp = String(row?.tp_lancamento ?? "").toLowerCase().trim();
    const st = String(row?.status ?? "").toLowerCase().trim();
    // saída/débito
    const looksOut = nat === "d" ||
        nat.includes("deb") ||
        nat.includes("saida") ||
        nat.includes("desp") ||
        tp === "d" ||
        tp.includes("deb") ||
        tp.includes("saida") ||
        tp.includes("pag") ||
        st.includes("pagar");
    // entrada/crédito
    const looksIn = nat === "c" ||
        nat.includes("cred") ||
        nat.includes("entrada") ||
        nat.includes("rece") ||
        tp === "c" ||
        tp.includes("cred") ||
        tp.includes("entrada") ||
        tp.includes("rec");
    if (looksOut && !looksIn)
        return -v;
    return v;
}
router.get("/financial/statement", requireAuth, async (req, res) => {
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
        const rawCpfFromToken = String(req?.user?.cpf_cnpj ?? "");
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
        // ✅ compat cod_cliente (numérico vs string)
        const omieCodesNum = omieCodes
            .map((x) => Number(String(x).trim()))
            .filter((n) => Number.isFinite(n));
        const codesForIn = omieCodesNum.length ? omieCodesNum : omieCodes;
        const startIso0 = isoStartOfDay(startYmd);
        const endIso1 = isoEndOfDay(endYmd);
        // ✅ OR correto com AND por campo
        const orRange = [
            `and(dt_pagamento.gte.${startIso0},dt_pagamento.lte.${endIso1})`,
            `and(dt_emissao.gte.${startIso0},dt_emissao.lte.${endIso1})`,
            `and(dt_venc.gte.${startIso0},dt_venc.lte.${endIso1})`,
        ].join(",");
        const { data, error } = await supabase_1.supabaseAdmin
            .from("omie_mf_movements")
            .select("cod_mov_cc, dt_pagamento, dt_emissao, dt_venc, valor, descricao, natureza, tp_lancamento, status, cod_cliente, cod_categoria, cod_projeto, updated_at")
            .in("cod_cliente", codesForIn)
            .or(orRange)
            .order("updated_at", { ascending: false })
            .limit(5000);
        if (error)
            throw new Error(`Supabase omie_mf_movements error: ${error.message}`);
        const rows = Array.isArray(data) ? data : [];
        console.log("🧾 [statement] cpfFromToken =", rawCpfFromToken);
        console.log("🧾 [statement] omieCodesCount =", omieCodes.length, "omieCodesNumCount =", omieCodesNum.length);
        console.log("🧾 [statement] range =", startIso0, "->", endIso1);
        console.log("🧾 [statement] fetchedRows =", rows.length);
        if (rows[0]) {
            console.log("🧾 [statement] sampleRow =", {
                cod_mov_cc: rows[0].cod_mov_cc,
                dt_pagamento: rows[0].dt_pagamento,
                dt_emissao: rows[0].dt_emissao,
                dt_venc: rows[0].dt_venc,
                valor: rows[0].valor,
                natureza: rows[0].natureza,
                tp_lancamento: rows[0].tp_lancamento,
                status: rows[0].status,
                cod_cliente: rows[0].cod_cliente,
            });
        }
        const items = rows
            .map((row) => {
            const iso = pickMovementDateISO(row);
            const ymd = iso ? toYmdFromIso(iso) : null;
            const amountSigned = inferSignedAmount(row);
            return {
                id: row?.cod_mov_cc ? String(row.cod_mov_cc) : undefined,
                date: ymd,
                description: String(row?.descricao ?? "Movimentação").trim(),
                amount: amountSigned,
                // ✅ FIX TS: mantém literal "entrada" | "saida"
                type: (amountSigned >= 0 ? "entrada" : "saida"),
            };
        })
            .filter((it) => it.date && it.date >= startYmd && it.date <= endYmd)
            .sort((a, b) => String(b.date).localeCompare(String(a.date)));
        let totalIn = 0;
        let totalOut = 0;
        for (const it of items) {
            const a = coerceNumber(it.amount ?? 0);
            if (a >= 0)
                totalIn += a;
            else
                totalOut += Math.abs(a);
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
    }
    catch (e) {
        console.log("❌ /financial/statement error:", e?.message ?? e);
        return res.status(500).json({ ok: false, error: "INTERNAL_ERROR", message: e?.message ?? String(e) });
    }
});
/* =========================
   ✅ FINANCEIRO POR OPERAÇÃO - GET /operation-financial/:operationId
========================= */
/**
 * GET /operation-financial/:operationId
 */
router.get("/operation-financial/:operationId", requireAuth, async (req, res) => {
    try {
        const operationId = String(req.params.operationId || "").trim();
        if (!operationId || !isUuid(operationId)) {
            return res.status(400).json({ ok: false, error: "INVALID_OPERATION_ID", operationId });
        }
        const rawCpfFromToken = String(req?.user?.cpf_cnpj ?? "");
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
        const { data: op, error: opErr } = await supabase_1.supabaseAdmin
            .from("operations")
            .select("id,name")
            .eq("id", operationId)
            .single();
        if (opErr)
            throw new Error(`Supabase operations error: ${opErr.message}`);
        if (!op)
            return res.status(404).json({ ok: false, error: "OPERATION_NOT_FOUND" });
        const operationName = String(op.name ?? "").trim();
        if (!operationName)
            return res.status(400).json({ ok: false, error: "OPERATION_NAME_EMPTY" });
        const { data: projects, error: projErr } = await supabase_1.supabaseAdmin
            .from("omie_projects")
            .select("name,omie_internal_code")
            .ilike("name", `%${operationName}%`)
            .limit(20);
        if (projErr)
            throw new Error(`Supabase omie_projects error: ${projErr.message}`);
        const target = normName(operationName);
        const best = (projects ?? [])
            .map((p) => {
            const n = normName(p.name);
            const score = n === target ? 3 : n.includes(target) || target.includes(n) ? 2 : 1;
            return { ...p, score };
        })
            .sort((a, b) => b.score - a.score)[0] ?? null;
        if (!best?.omie_internal_code) {
            return res.status(404).json({ ok: false, error: "OMIE_PROJECT_NOT_FOUND_BY_NAME", operationName });
        }
        const projectInternalCode = String(best.omie_internal_code ?? "").trim();
        const invested = await sumMovements({ projectInternalCode, categoryCode: "1.04.02", omieCodes });
        const realized = await sumMovements({ projectInternalCode, categoryCode: "2.10.98", omieCodes });
        const amountInvested = invested.total;
        const realizedValue = realized.total;
        const expectedProfit = amountInvested && roiExpectedPercent ? amountInvested * (roiExpectedPercent / 100) : 0;
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
    }
    catch (e) {
        console.log("❌ /operation-financial error:", e?.message ?? e);
        return res.status(500).json({ ok: false, error: "INTERNAL_ERROR", message: e?.message ?? String(e) });
    }
});
exports.default = router;
