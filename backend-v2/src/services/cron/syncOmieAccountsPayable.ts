import { supabaseAdmin } from "../../lib/supabase";
import { getLastSyncAt, setLastSyncAt } from "./syncState";
import { omieFetchAllPaged } from "../omie/omiePaged";

const SOURCE = "omie_accounts_payable";

function s(v: any) {
  return String(v ?? "").trim();
}

function toISODate(v: any): string | null {
  const t = s(v);
  if (!t) return null;
  const d = new Date(t);
  if (!isNaN(d.getTime())) return d.toISOString();
  return t; // fallback (se vier "YYYY-MM-DD" já está ok)
}

function toNumber(v: any): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function syncOmieAccountsPayable() {
  const last = await getLastSyncAt(SOURCE);
  const since = last ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { items, pages } = await omieFetchAllPaged<any>({
    endpointPath: "/financas/contapagar/",
    call: "ListarContasPagar",
    baseParams: {
      registros_por_pagina: 200,
      // dt_alt_de: since, // se estiver disponível no seu omiePaged
    },
  });

  const payloads = (items || [])
    .map((x) => {
      const omie_payable_id = s(
        x.codigo_lancamento_omie ??
          x.id ??
          x.codigo ??
          x.omie_payable_id ??
          x.nCodLancamento ?? // alguns retornos usam isso
          ""
      );
      if (!omie_payable_id) return null;

      return {
        omie_payable_id,

        // suas colunas reais:
        project_scp: s(x.projeto_scp ?? x.project_scp ?? x.cProjeto ?? x.cCodProjeto ?? ""),
        category_code: s(x.codigo_categoria ?? x.category_code ?? x.cCodCateg ?? x.cCategoria ?? ""),
        party_omie_code: s(x.codigo_cliente_fornecedor ?? x.party_omie_code ?? x.nCodCliente ?? x.nCodFornecedor ?? ""),
        issue_date: toISODate(x.data_emissao ?? x.issue_date ?? x.dDtEmissao),
        due_date: toISODate(x.data_vencimento ?? x.due_date ?? x.dDtVenc),
        payment_date: toISODate(x.data_pagamento ?? x.payment_date ?? x.dDtPagamento),
        amount: toNumber(x.valor_documento ?? x.amount ?? x.nValorTitulo ?? x.valor),
        status: s(x.status_titulo ?? x.status ?? x.cStatus ?? ""),
        description: s(x.observacao ?? x.descricao ?? x.description ?? ""),

        raw_payload: x,
        updated_at: new Date().toISOString(),
      };
    })
    .filter(Boolean) as any[];

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
