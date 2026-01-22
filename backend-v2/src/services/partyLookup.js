"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findPartyByCpf = findPartyByCpf;
// backend-v2/src/services/partyLookup.ts
const supabase_1 = require("../lib/supabase");
const onlyDigits = (s = "") => String(s).replace(/\D/g, "");
async function findPartyByCpf(cpfRaw) {
    const cpfDigits = onlyDigits(cpfRaw);
    if (!cpfDigits || ![11, 14].includes(cpfDigits.length)) {
        return null;
    }
    const { data, error } = await supabase_1.supabaseAdmin
        .from("omie_parties")
        .select("id, name, cpf_cnpj, omie_code")
        .or([
        `cpf_cnpj.eq.${cpfRaw}`,
        `cpf_cnpj.eq.${cpfDigits}`,
        `cpf_cnpj.ilike.%${cpfDigits}%`,
    ].join(","))
        .limit(1)
        .maybeSingle();
    if (error)
        throw error;
    return data ?? null;
}
