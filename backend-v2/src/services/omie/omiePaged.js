"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.omieFetchAllPaged = omieFetchAllPaged;
const callOmie_1 = require("./callOmie");
function pickArray(obj) {
    if (!obj || typeof obj !== "object")
        return [];
    // Omie costuma devolver listas com nomes diferentes, então tentamos achar a lista automaticamente
    const candidates = [
        "categoria_cadastro",
        "cliente_cadastro",
        "projeto_cadastro",
        "conta_pagar_cadastro",
        "movimentos",
        "lista",
        "registros",
        "cadastros",
        "dados",
    ];
    for (const k of candidates) {
        if (Array.isArray(obj[k]))
            return obj[k];
    }
    // fallback: pega o primeiro array que encontrar
    for (const k of Object.keys(obj)) {
        if (Array.isArray(obj[k]))
            return obj[k];
    }
    return [];
}
function getTotalPages(obj) {
    const n = Number(obj?.total_de_paginas ?? obj?.total_de_paginas ?? obj?.totalPaginas ?? obj?.total_pages);
    return Number.isFinite(n) && n > 0 ? n : 1;
}
async function omieFetchAllPaged(opts) {
    const maxPages = opts.maxPages ?? 200; // segurança
    const items = [];
    // primeira página
    const first = await (0, callOmie_1.callOmie)(opts.endpointPath, opts.call, [{
            ...opts.baseParams,
            pagina: 1,
        }]);
    const firstItems = pickArray(first);
    items.push(...firstItems);
    const totalPages = Math.min(getTotalPages(first), maxPages);
    // demais páginas
    for (let p = 2; p <= totalPages; p++) {
        const resp = await (0, callOmie_1.callOmie)(opts.endpointPath, opts.call, [{
                ...opts.baseParams,
                pagina: p,
            }]);
        const pageItems = pickArray(resp);
        items.push(...pageItems);
    }
    return { items, pages: totalPages };
}
