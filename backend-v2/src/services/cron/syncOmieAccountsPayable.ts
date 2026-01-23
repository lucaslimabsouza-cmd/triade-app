import { supabaseAdmin } from "../../lib/supabase";
import { getLastSyncAt, setLastSyncAt } from "./syncState";
import { omieFetchAllPaged } from "../omie/omiePaged";

const SOURCE = "omie_accounts_payable";

function s(v: any) {
  return String(v ?? "").trim();
}

function toNumber(v: any): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * ✅ Aceita:
 * - DD/MM/YYYY
 * - DD/MM/YYYY HH:mm[:ss]
 * - ISO / formatos normais reconhecidos pelo Date
 */
function parseDateAny(v: any): string | null {
  const t = s(v);
  if (!t) return null;

  // dd/mm/yyyy (com ou sem hora)
  const m = t.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    const HH = Number(m[4] ?? 0);
    const MI = Number(m[5] ?? 0);
    const SS = Number(m[6] ?? 0);
    const dt = new Date(Date.UTC(yyyy, mm - 1, dd, HH, MI, SS));
    return isNaN(dt.getTime()) ? null : dt.toISOString();
  }

  // tenta parse normal
  const dt = new Date(t);
  return isNaN(dt.getTime()) ? null : dt.toISOString();
}

export async function syncOmieAccountsPayable(options?: { fullSync?: boolean }) {
  const last = options?.fullSync ? null : await getLastSyncAt(SOURCE);
  const since =
    last ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { items, pages } = await omieFetchAllPaged<any>({
    endpointPath: "/financas/contapagar/",
    call: "ListarContasPagar",
    baseParams: {
      registros_por_pagina: 200,
      // se você tiver filtro incremental real no omiePaged, ativamos depois
      // dt_alt_de: since,
    },
  });

  const payloads = (items || [])
    .map((x) => {
      const omie_payable_id = s(
        x.codigo_lancamento_omie ??
          x.omie_payable_id ??
          x.id ??
          x.codigo ??
          x.nCodLancamento ??
          ""
      );
      if (!omie_payable_id) return null;

      return {
        omie_payable_id,

        // ✅ suas colunas reais do Supabase
        project_scp: s(x.project_scp ?? x.projeto_scp ?? x.cProjeto ?? x.cCodProjeto ?? ""),
        category_code: s(x.category_code ?? x.codigo_categoria ?? x.cCodCateg ?? x.cCategoria ?? ""),
        party_omie_code: s(
          x.party_omie_code ??
            x.codigo_cliente_fornecedor ??
            x.nCodCliente ??
            x.nCodFornecedor ??
            ""
        ),

        issue_date: parseDateAny(x.issue_date ?? x.data_emissao ?? x.dDtEmissao),
        due_date: parseDateAny(x.due_date ?? x.data_vencimento ?? x.dDtVenc),
        payment_date: parseDateAny(x.payment_date ?? x.data_pagamento ?? x.dDtPagamento),

        amount: toNumber(x.amount ?? x.valor_documento ?? x.nValorTitulo ?? x.valor),
        status: s(x.status ?? x.status_titulo ?? x.cStatus ?? ""),
        description: s(x.description ?? x.observacao ?? x.descricao ?? ""),

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
