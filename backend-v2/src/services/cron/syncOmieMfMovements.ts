import { supabaseAdmin } from "../../lib/supabase";
import { getLastSyncAt, setLastSyncAt } from "./syncState";
import { callOmie } from "../omie/callOmie";

const SOURCE = "omie_mf_movements";

function s(v: any) {
  return String(v ?? "").trim();
}

/**
 * Omie costuma devolver datas como:
 * - "15/12/2025"
 * - "15/12/2025 13:45:00"
 * E o Postgres/Supabase quer ISO.
 */
function parseBRDateToISO(v: any): string | null {
  const t = s(v);
  if (!t) return null;

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

  // fallback: tenta parse normal (ISO etc)
  const dt = new Date(t);
  return isNaN(dt.getTime()) ? null : dt.toISOString();
}

/**
 * ✅ Omie filtros de data normalmente em DD/MM/YYYY
 */
function isoToOmieDateBR(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    // fallback se vier algo estranho
    // tenta pegar yyyy-mm-dd e converter
    const m = String(iso).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return String(iso).slice(0, 10);
  }
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getUTCFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function pickCodMovCC(m: any): number {
  const det = m?.detalhes ?? {};
  const res = m?.resumo ?? {};

  const raw =
    det?.nCodMovCC ??
    det?.cod_mov_cc ??
    det?.nCodMovimento ??
    res?.nCodMovCC ??
    res?.cod_mov_cc ??
    m?.nCodMovCC ??
    m?.cod_mov_cc ??
    0;

  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export async function syncOmieMfMovements() {
  const last = await getLastSyncAt(SOURCE);
  const sinceIso =
    last ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // ✅ formato certo pro Omie
  const sinceDateBR = isoToOmieDateBR(sinceIso);

  const perPage = 200;
  let page = 1;
  let pages = 0;
  let fetched = 0;
  let upserted = 0;

  // Vamos upsertar por página pra não acumular tudo em memória
  while (true) {
    let resp: any;

    try {
      resp = await callOmie(
        "/financas/mf/",
        "ListarMovimentos",
        [
          {
            nPagina: page,
            nRegPorPagina: perPage,
            dDtAltDe: sinceDateBR,
          },
        ]
      );
    } catch (err: any) {
      // ✅ log útil pro Render (sem vazar secrets)
      const status = err?.response?.status;
      const data = err?.response?.data;
      console.log("[mf_movements] omie error status:", status);
      console.log("[mf_movements] omie error data:", JSON.stringify(data ?? {}, null, 2));
      throw new Error(
        `Omie ListarMovimentos falhou (status ${status ?? "?"}): ${JSON.stringify(
          data ?? { message: err?.message },
          null,
          2
        )}`
      );
    }

    const movimentos = resp?.movimentos ?? [];
    const totalPages = Number(resp?.nTotPaginas ?? 1);

    pages = totalPages;
    fetched += movimentos.length;

    const batch = (movimentos || [])
      .map((m: any) => {
        const det = m?.detalhes ?? {};

        const cod_mov_cc = pickCodMovCC(m);
        if (!cod_mov_cc) return null;

        return {
          cod_mov_cc,
          mf_key: s(det.cCodIntTitulo ?? det.mf_key ?? ""),
          tp_lancamento: s(det.cTipo ?? det.cTpLancamento ?? ""),
          natureza: s(det.cNatureza ?? ""),
          cod_titulo: det.nCodTitulo ?? null,
          cod_baixa: det.nCodBaixa ?? null,
          cod_cliente: det.nCodCliente ?? null,
          cod_projeto: det.cCodProjeto ?? det.nCodProjeto ?? null,
          cod_categoria: s(det.cCodCateg ?? det.cCodCategoria ?? ""),

          // datas BR -> ISO
          dt_emissao: parseBRDateToISO(det.dDtEmissao),
          dt_venc: parseBRDateToISO(det.dDtVenc),
          dt_pagamento: parseBRDateToISO(det.dDtPagamento),

          valor: Number(det.nValorTitulo ?? det.nValorMovCC ?? det.nValor ?? 0) || 0,
          status: s(det.cStatus ?? ""),
          descricao: s(det.observacao ?? det.cNumDocFiscal ?? det.cDescricao ?? ""),

          raw_payload: m,

          // updated_at: tenta data de alteração; se vier BR converte
          updated_at:
            parseBRDateToISO(det.dDtAlt) ?? new Date().toISOString(),
        };
      })
      .filter(Boolean) as any[];

    if (batch.length) {
      const { error } = await supabaseAdmin
        .from("omie_mf_movements")
        .upsert(batch, { onConflict: "cod_mov_cc" });

      if (error) throw new Error(error.message);
      upserted += batch.length;
    }

    if (page >= totalPages) break;
    page++;
  }

  const newSyncAt = new Date().toISOString();
  await setLastSyncAt(SOURCE, newSyncAt);

  return { fetched, pages, upserted, since: sinceIso, newSyncAt };
}
