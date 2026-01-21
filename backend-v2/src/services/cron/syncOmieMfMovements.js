"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncOmieMfMovements = syncOmieMfMovements;
const supabase_1 = require("../../lib/supabase");
const syncState_1 = require("./syncState");
const callOmie_1 = require("../omie/callOmie");
const SOURCE = "omie_mf_movements";
function s(v) {
    return String(v ?? "").trim();
}
function toISO(v) {
    const t = s(v);
    if (!t)
        return null;
    const d = new Date(t);
    return isNaN(d.getTime()) ? t : d.toISOString();
}
function isoToOmieDate(iso) {
    // Omie pede string 10 (ex: YYYY-MM-DD) em vários filtros (dDtAltDe)
    return iso.slice(0, 10);
}
async function syncOmieMfMovements() {
    const last = await (0, syncState_1.getLastSyncAt)(SOURCE);
    const sinceIso = last ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const sinceDate = isoToOmieDate(sinceIso);
    const perPage = 500;
    let page = 1;
    let pages = 0;
    let fetched = 0;
    const payloads = [];
    while (true) {
        const resp = await (0, callOmie_1.callOmie)("/financas/mf/", // ✅ correto :contentReference[oaicite:4]{index=4}
        "ListarMovimentos", // ✅ correto :contentReference[oaicite:5]{index=5}
        [
            {
                nPagina: page,
                nRegPorPagina: perPage,
                dDtAltDe: sinceDate, // ✅ incremental :contentReference[oaicite:6]{index=6}
                // você pode passar outros filtros aqui se quiser reduzir (ex: cTpLancamento)
            },
        ]);
        const movimentos = resp?.movimentos ?? [];
        const totalPages = Number(resp?.nTotPaginas ?? 1);
        pages = totalPages;
        fetched += movimentos.length;
        for (const m of movimentos) {
            const det = m?.detalhes ?? {};
            const res = m?.resumo ?? {};
            // chave única que você escolheu:
            const cod_mov_cc = Number(det.nCodMovCC ?? det.cod_mov_cc ?? det.nCodMovimento ?? 0);
            if (!Number.isFinite(cod_mov_cc) || !cod_mov_cc)
                continue;
            payloads.push({
                cod_mov_cc,
                mf_key: s(det.cCodIntTitulo ?? det.mf_key ?? ""),
                tp_lancamento: s(det.cTipo ?? det.cTpLancamento ?? ""),
                natureza: s(det.cNatureza ?? ""),
                cod_titulo: det.nCodTitulo ?? null,
                cod_baixa: det.nCodBaixa ?? null,
                cod_cliente: det.nCodCliente ?? null,
                cod_projeto: det.cCodProjeto ?? det.nCodProjeto ?? null,
                cod_categoria: s(det.cCodCateg ?? ""),
                dt_emissao: toISO(det.dDtEmissao),
                dt_venc: toISO(det.dDtVenc),
                dt_pagamento: toISO(det.dDtPagamento),
                valor: Number(det.nValorTitulo ?? det.nValorMovCC ?? 0) || 0,
                status: s(det.cStatus ?? ""),
                descricao: s(det.observacao ?? det.cNumDocFiscal ?? ""),
                raw_payload: m,
                updated_at: toISO(det.dDtAlt ?? new Date().toISOString()),
            });
        }
        if (page >= totalPages)
            break;
        page++;
    }
    // upsert em lotes
    let upserted = 0;
    const BATCH = 300;
    for (let i = 0; i < payloads.length; i += BATCH) {
        const batch = payloads.slice(i, i + BATCH);
        const { error } = await supabase_1.supabaseAdmin
            .from("omie_mf_movements")
            .upsert(batch, { onConflict: "cod_mov_cc" });
        if (error)
            throw new Error(error.message);
        upserted += batch.length;
    }
    const newSyncAt = new Date().toISOString();
    await (0, syncState_1.setLastSyncAt)(SOURCE, newSyncAt);
    return { fetched, pages, upserted, since: sinceIso, newSyncAt };
}
