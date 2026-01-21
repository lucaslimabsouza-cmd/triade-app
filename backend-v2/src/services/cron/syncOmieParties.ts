import { supabaseAdmin } from "../../lib/supabase";
import { getLastSyncAt, setLastSyncAt } from "./syncState";
import { omieFetchAllPaged } from "../omie/omiePaged";

const SOURCE = "omie_parties";

export async function syncOmieParties() {
  const last = await getLastSyncAt(SOURCE);
  const since = last ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { items, pages } = await omieFetchAllPaged<any>({
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
    const { error } = await supabaseAdmin
      .from("omie_parties")
      .upsert(payloads, { onConflict: "omie_code" });
    if (error) throw new Error(error.message);
  }

  const newSyncAt = new Date().toISOString();
  await setLastSyncAt(SOURCE, newSyncAt);

  return { fetched: items.length, pages, upserted: payloads.length, since, newSyncAt };
}
