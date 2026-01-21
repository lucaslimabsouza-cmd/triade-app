"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncOmieCategories = syncOmieCategories;
const supabase_1 = require("../../lib/supabase");
const syncState_1 = require("./syncState");
const omiePaged_1 = require("../omie/omiePaged");
const SOURCE = "omie_categories";
async function syncOmieCategories() {
    const last = await (0, syncState_1.getLastSyncAt)(SOURCE);
    // categories mudam pouco → não precisa lookback grande
    const since = last ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { items, pages } = await (0, omiePaged_1.omieFetchAllPaged)({
        endpointPath: "/geral/categorias/",
        call: "ListarCategorias",
        baseParams: {
            registros_por_pagina: 200,
            // alguns endpoints aceitam filtro por data, se não aceitar, ele ignora e volta tudo
            // dt_alt_de: since,
        },
    });
    const payloads = items
        .map((x) => ({
        omie_code: String(x.codigo ?? x.omie_code ?? "").trim(),
        name: x.descricao ?? x.nome ?? null,
        raw_payload: x,
        updated_at: new Date().toISOString(),
    }))
        .filter((p) => !!p.omie_code);
    if (payloads.length) {
        const { error } = await supabase_1.supabaseAdmin
            .from("omie_categories")
            .upsert(payloads, { onConflict: "omie_code" });
        if (error)
            throw new Error(error.message);
    }
    const newSyncAt = new Date().toISOString();
    await (0, syncState_1.setLastSyncAt)(SOURCE, newSyncAt);
    return { fetched: items.length, pages, upserted: payloads.length, since, newSyncAt };
}
