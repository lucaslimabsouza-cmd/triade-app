import { supabaseAdmin } from "../../lib/supabase";
import { getLastSyncAt, setLastSyncAt } from "./syncState";
import { omieFetchAllPaged } from "../omie/omiePaged";

const SOURCE = "omie_projects";

function s(v: any) {
  return String(v ?? "").trim();
}

export async function syncOmieProjects() {
  const last = await getLastSyncAt(SOURCE);
  const since = last ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { items, pages } = await omieFetchAllPaged<any>({
    endpointPath: "/geral/projetos/",
    call: "ListarProjetos",
    baseParams: {
      registros_por_pagina: 200,
      // dt_alt_de: since, // se você confirmar que o Omie aceita, ativamos
    },
  });

  const payloads = (items || [])
    .map((x) => {
      const internal = s(x.codigo ?? x.omie_internal_code ?? x.codigo_projeto ?? x.id);
      if (!internal) return null;

      const external = s(x.codigo_externo ?? x.omie_code);
      return {
        omie_internal_code: internal,         // ✅ chave principal
        omie_code: external || internal,      // ✅ nunca null (resolve NOT NULL)
        name: x.nome ?? x.descricao ?? null,
        raw_payload: x,
        updated_at: new Date().toISOString(),
      };
    })
    .filter(Boolean) as any[];

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
