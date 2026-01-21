import { supabaseAdmin } from "../../lib/supabase";
import { getLastSyncAt, setLastSyncAt } from "./syncState";
import { omieFetchAllPaged } from "../omie/omiePaged";

const SOURCE = "omie_projects";

export async function syncOmieProjects() {
  const last = await getLastSyncAt(SOURCE);
  const since = last ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { items, pages } = await omieFetchAllPaged<any>({
    endpointPath: "/geral/projetos/",
    call: "ListarProjetos",
    baseParams: {
      registros_por_pagina: 200,
      // dt_alt_de: since,
    },
  });

  const payloads = items
    .map((x) => ({
      omie_internal_code: String(x.codigo ?? x.omie_internal_code ?? x.codigo_projeto ?? "").trim(),
      omie_code: x.codigo_externo ?? x.omie_code ?? null,
      name: x.nome ?? x.descricao ?? null,
      raw_payload: x,
      updated_at: new Date().toISOString(),
    }))
    .filter((p) => !!p.omie_internal_code);

  if (payloads.length) {
    const { error } = await supabaseAdmin
      .from("omie_projects")
      .upsert(payloads, { onConflict: "omie_internal_code" });
    if (error) throw new Error(error.message);
  }

  const newSyncAt = new Date().toISOString();
  await setLastSyncAt(SOURCE, newSyncAt);

  return { fetched: items.length, pages, upserted: payloads.length, since, newSyncAt };
}
