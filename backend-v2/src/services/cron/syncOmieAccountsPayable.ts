import { supabaseAdmin } from "../../lib/supabase";
import { getLastSyncAt, setLastSyncAt } from "./syncState";
import { omieFetchAllPaged } from "../omie/omiePaged";

const SOURCE = "omie_accounts_payable";

export async function syncOmieAccountsPayable() {
  const last = await getLastSyncAt(SOURCE);

  // contas a pagar mudam bastante: lookback curto e frequente
  const since = last ?? new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

  const { items, pages } = await omieFetchAllPaged<any>({
    endpointPath: "/financas/contapagar/",
    call: "ListarContasPagar",
    baseParams: {
      registros_por_pagina: 200,
      // dt_alt_de: since,
    },
  });

  const payloads = items
    .map((x) => ({
      omie_payable_id: String(x.codigo_lancamento_omie ?? x.omie_payable_id ?? x.codigo ?? "").trim(),
      cod_titulo: x.codigo_titulo ?? x.cod_titulo ?? null,
      cod_cliente: x.codigo_cliente_fornecedor ?? x.cod_cliente ?? null,
      cod_projeto: x.codigo_projeto ?? x.cod_projeto ?? null,
      cod_categoria: x.codigo_categoria ?? x.cod_categoria ?? null,
      dt_emissao: x.data_emissao ?? x.dt_emissao ?? null,
      dt_venc: x.data_vencimento ?? x.dt_venc ?? null,
      dt_pagamento: x.data_pagamento ?? x.dt_pagamento ?? null,
      valor: x.valor_documento ?? x.valor ?? null,
      status: x.status_titulo ?? x.status ?? null,
      descricao: x.observacao ?? x.descricao ?? null,
      raw_payload: x,
      updated_at: new Date().toISOString(),
    }))
    .filter((p) => !!p.omie_payable_id);

  if (payloads.length) {
    const { error } = await supabaseAdmin
      .from("omie_accounts_payable")
      .upsert(payloads, { onConflict: "omie_payable_id" });
    if (error) throw new Error(error.message);
  }

  const newSyncAt = new Date().toISOString();
  await setLastSyncAt(SOURCE, newSyncAt);

  return { fetched: items.length, pages, upserted: payloads.length, since, newSyncAt };
}
