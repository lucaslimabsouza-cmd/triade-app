"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncOmieParties = syncOmieParties;
const supabase_1 = require("../../lib/supabase");
const syncState_1 = require("./syncState");
const omiePaged_1 = require("../omie/omiePaged");
const SOURCE = "omie_parties";
async function syncOmieParties() {
    const last = await (0, syncState_1.getLastSyncAt)(SOURCE);
    const since = last ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { items, pages } = await (0, omiePaged_1.omieFetchAllPaged)({
        endpointPath: "/geral/clientes/",
        call: "ListarClientes",
        baseParams: {
            registros_por_pagina: 200,
            // dt_alt_de: since,
        },
    });
    const payloads = items
        .map((x) => ({
        omie_code: String(x.codigo_cliente_omie ?? x.codigo ?? x.omie_code ?? "").trim(),
        name: x.nome_fantasia ?? x.razao_social ?? x.nome ?? null,
        cpf_cnpj: x.cnpj_cpf ?? x.cpf_cnpj ?? null,
        raw_payload: x,
        updated_at: new Date().toISOString(),
    }))
        .filter((p) => !!p.omie_code);
    if (payloads.length) {
        const { error } = await supabase_1.supabaseAdmin
            .from("omie_parties")
            .upsert(payloads, { onConflict: "omie_code" });
        if (error)
            throw new Error(error.message);
    }
    const newSyncAt = new Date().toISOString();
    await (0, syncState_1.setLastSyncAt)(SOURCE, newSyncAt);
    return { fetched: items.length, pages, upserted: payloads.length, since, newSyncAt };
}
