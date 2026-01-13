"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../../lib/supabase");
const callOmie_1 = require("../../services/omie/callOmie");
const router = (0, express_1.Router)();
/**
 * Helpers
 */
const extractSCP = (text) => {
    const s = String(text ?? "");
    const m = s.match(/(SCP\d{4})/i);
    return m ? m[1].toUpperCase() : null;
};
const toISODate = (v) => {
    if (!v)
        return null;
    const s = String(v).trim();
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m)
        return `${m[3]}-${m[2]}-${m[1]}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s))
        return s;
    return null;
};
/**
 * GETs informativos
 */
router.get("/mf", (_req, res) => res.json({ ok: true, hint: "Use POST /sync/omie/mf (Movimentos Financeiros)" }));
/**
 * POST /sync/omie/mf
 * Body opcional:
 * {
 *   "cTpLancamento": "CC",         // default "CC"
 *   "nRegPorPagina": 500,          // default 500
 *   "maxPages": 50                 // opcional; se não vier usa ENV MAX_PAGES ou 50
 * }
 *
 * Importa movimentos do MF (ListarMovimentos) e grava em omie_mf_movements.
 */
router.post("/mf", async (req, res) => {
    try {
        const endpointPath = "financas/mf/";
        const call = "ListarMovimentos";
        const cTpLancamento = req.body?.cTpLancamento || "CC";
        const nRegPorPagina = Number(req.body?.nRegPorPagina ?? 500);
        const envMaxPages = Number(process.env.MAX_PAGES ?? 50);
        const maxPages = Number(req.body?.maxPages ?? envMaxPages);
        let nPagina = 1;
        let imported = 0;
        let failed = 0;
        let totalFetched = 0;
        while (true) {
            const data = await (0, callOmie_1.callOmie)(endpointPath, call, [
                {
                    nPagina,
                    nRegPorPagina,
                    cTpLancamento, // <- o que você pediu (CC/CCE/CCS/CPCR/BX etc)
                },
            ]);
            const totalPages = Number(data?.nTotPaginas ?? 1);
            const lista = (data?.movimentos ?? []);
            totalFetched += lista.length;
            for (const mov of lista) {
                const det = mov?.detalhes ?? {};
                // chaves possíveis no retorno do MF
                const codTitulo = det?.nCodTitulo ?? null;
                const codMovCC = det?.nCodMovCC ?? null;
                const codBaixa = det?.nCodBaixa ?? null;
                // mf_key: garante unicidade mesmo quando não vem um id único “bonito”
                const mf_key = [
                    cTpLancamento,
                    codTitulo ?? 0,
                    codMovCC ?? 0,
                    codBaixa ?? 0,
                    det?.cNumTitulo ?? "",
                    det?.cNumDocFiscal ?? "",
                    det?.dDtPagamento ?? "",
                    det?.nValorMovCC ?? det?.nValorTitulo ?? "",
                ].join("|");
                // tenta linkar com SCP se tiver no texto (observação / histórico / etc)
                const project_scp = extractSCP(det?.observacao) ||
                    extractSCP(det?.historico) ||
                    extractSCP(det?.cNumCtr) ||
                    extractSCP(det?.cNumOS) ||
                    null;
                const payload = {
                    mf_key,
                    tp_lancamento: cTpLancamento,
                    natureza: det?.cNatureza ?? null,
                    cod_titulo: codTitulo,
                    cod_mov_cc: codMovCC,
                    cod_baixa: codBaixa,
                    cod_cliente: det?.nCodCliente ?? null,
                    cod_projeto: det?.cCodProjeto ?? null,
                    cod_categoria: det?.cCodCateg ?? null,
                    dt_emissao: toISODate(det?.dDtEmissao),
                    dt_venc: toISODate(det?.dDtVenc),
                    dt_pagamento: toISODate(det?.dDtPagamento),
                    valor: det?.nValorMovCC ?? det?.nValorTitulo ?? null,
                    status: det?.cStatus ?? null,
                    descricao: det?.observacao ?? det?.cNumTitulo ?? det?.cNumDocFiscal ?? null,
                    // guardamos tudo para auditoria/ajustes depois:
                    raw_payload: { ...mov, __project_scp: project_scp },
                    updated_at: new Date().toISOString(),
                };
                const { error } = await supabase_1.supabaseAdmin
                    .from("omie_mf_movements")
                    .upsert(payload, { onConflict: "mf_key" });
                if (error) {
                    failed++;
                    console.error("UPSERT mf error:", error.message, "mf_key:", mf_key);
                }
                else {
                    imported++;
                }
            }
            // freios
            if (nPagina >= totalPages)
                break;
            if (nPagina >= maxPages)
                break;
            nPagina++;
        }
        return res.json({
            ok: true,
            cTpLancamento,
            imported,
            failed,
            totalFetched,
            pagesProcessed: nPagina,
            maxPages,
        });
    }
    catch (err) {
        return res.status(500).json({
            ok: false,
            error: err?.response?.data ?? err?.message ?? "Erro ao sincronizar MF",
        });
    }
});
exports.default = router;
