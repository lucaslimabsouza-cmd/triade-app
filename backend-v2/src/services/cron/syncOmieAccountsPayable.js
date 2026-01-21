"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncOmieAccountsPayable = syncOmieAccountsPayable;
const supabase_1 = require("../../lib/supabase");
const syncState_1 = require("./syncState");
const omiePaged_1 = require("../omie/omiePaged");
const SOURCE = "omie_accounts_payable";
function s(v) {
    return String(v ?? "").trim();
}
function toISODate(v) {
    const t = s(v);
    if (!t)
        return null;
    const d = new Date(t);
    if (!isNaN(d.getTime()))
        return d.toISOString();
    return t; // fallback (se vier "YYYY-MM-DD" já está ok)
}
function toNumber(v) {
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? n : 0;
}
async function syncOmieAccountsPayable() {
    const last = await (0, syncState_1.getLastSyncAt)(SOURCE);
    const since = last ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { items, pages } = await (0, omiePaged_1.omieFetchAllPaged)({
        endpointPath: "/financas/contapagar/",
        call: "ListarContasPagar",
        baseParams: {
            registros_por_pagina: 200,
            // dt_alt_de: since, // se estiver disponível no seu omiePaged
        },
    });
    const payloads = (items || [])
        .map((x) => {
        const omie_payable_id = s(x.codigo_lancamento_omie ??
            x.id ??
            x.codigo ??
            x.omie_payable_id ??
            x.nCodLancamento ?? // alguns retornos usam isso
            "");
        if (!omie_payable_id)
            return null;
        return {
            omie_payable_id,
            // suas colunas reais:
            project_scp: s(x.projeto_scp ?? x.project_scp ?? x.cProjeto ?? x.cCodProjeto ?? ""),
            category_code: s(x.codigo_categoria ?? x.category_code ?? x.cCodCateg ?? x.cCategoria ?? ""),
            party_omie_code: s(x.codigo_cliente_fornecedor ?? x.party_omie_code ?? x.nCodCliente ?? x.nCodFornecedor ?? ""),
            issue_date: toISODate(x.data_emissao ?? x.issue_date ?? x.dDtEmissao),
            due_date: toISODate(x.data_vencimento ?? x.due_date ?? x.dDtVenc),
            payment_date: toISODate(x.data_pagamento ?? x.payment_date ?? x.dDtPagamento),
            amount: toNumber(x.valor_documento ?? x.amount ?? x.nValorTitulo ?? x.valor),
            status: s(x.status_titulo ?? x.status ?? x.cStatus ?? ""),
            description: s(x.observacao ?? x.descricao ?? x.description ?? ""),
            raw_payload: x,
            updated_at: new Date().toISOString(),
        };
    })
        .filter(Boolean);
    if (payloads.length) {
        const { error } = await supabase_1.supabaseAdmin
            .from("omie_accounts_payable")
            .upsert(payloads, { onConflict: "omie_payable_id" });
        if (error)
            throw new Error(error.message);
    }
    const newSyncAt = new Date().toISOString();
    await (0, syncState_1.setLastSyncAt)(SOURCE, newSyncAt);
    return { fetched: items.length, pages, upserted: payloads.length, since, newSyncAt };
}
