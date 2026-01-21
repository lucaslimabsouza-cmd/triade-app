import { supabaseAdmin } from "../../lib/supabase";
import { getLastSyncAt, setLastSyncAt } from "./syncState";
import { omieFetchAllPaged } from "../omie/omiePaged";

const SOURCE = "omie_mf_movements";

export async function syncOmieMfMovements() {
  const last = await getLastSyncAt(SOURCE);
  const since = last ?? new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const { items, pages } = await omieFetchAllPaged<any>({
    endpointPath: "/financas/movimentos/",
    call: "ListarMovimentos",
    baseParams: {
      registros_por_pagina: 200,
      // dt_alt_de: since,
    },
  });

  const payloads = items
    .map((m) => ({
      cod_mov_cc: Number(m.nCodMovCC ?? m.cod_mov_cc ?? m.codMovCC),
      mf_key: String(m.mf_key ?? ""),
      tp_lancamento: String(m.cTpLancamento ?? m.tp_lancamento ?? ""),
      natureza: String(m.cNatureza ?? m.natureza ?? ""),
      cod_titulo: m.nCodTitulo ?? m.cod_titulo ?? null,
      cod_baixa: m.nCodBaixa ?? m.cod_baixa ?? null,
      cod_cliente: m.nCodCliente ?? m.cod_cliente ?? null,
      cod_projeto: m.nCodProjeto ?? m.cod_projeto ?? null,
      cod_categoria: m.nCodCategoria ?? m.cod_categoria ?? null,
      dt_emissao: m.dDtEmissao ?? m.dt_emissao ?? null,
      dt_venc: m.dDtVenc ?? m.dt_venc ?? null,
      dt_pagamento: m.dDtPagamento ?? m.dt_pagamento ?? null,
      valor: Number(m.nValor ?? m.valor ?? 0),
      status: String(m.cStatus ?? m.status ?? ""),
      descricao: String(m.cDescricao ?? m.descricao ?? ""),
      raw_payload: m,
      updated_at: new Date().toISOString(),
    }))
    .filter((p) => p.cod_mov_cc && Number.isFinite(p.cod_mov_cc));

  if (payloads.length) {
    const { error } = await supabaseAdmin
      .from("omie_mf_movements")
      .upsert(payloads, { onConflict: "cod_mov_cc" });
    if (error) throw new Error(error.message);
  }

  const newSyncAt = new Date().toISOString();
  await setLastSyncAt(SOURCE, newSyncAt);

  return { fetched: items.length, pages, upserted: payloads.length, since, newSyncAt };
}
