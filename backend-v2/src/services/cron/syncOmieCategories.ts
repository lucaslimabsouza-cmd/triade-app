import { supabaseAdmin } from "../../lib/supabase";
import { getLastSyncAt, setLastSyncAt } from "./syncState";
import { omieFetchAllPaged } from "../omie/omiePaged";

const SOURCE = "omie_categories";

export async function syncOmieCategories() {
  const last = await getLastSyncAt(SOURCE);
  // categories mudam pouco → não precisa lookback grande
  const since = last ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { items, pages } = await omieFetchAllPaged<any>({
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
    const { error } = await supabaseAdmin
      .from("omie_categories")
      .upsert(payloads, { onConflict: "omie_code" });
    if (error) throw new Error(error.message);
  }

  const newSyncAt = new Date().toISOString();
  await setLastSyncAt(SOURCE, newSyncAt);

  return { fetched: items.length, pages, upserted: payloads.length, since, newSyncAt };
}
