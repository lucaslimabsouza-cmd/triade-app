import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase";
// TODO: importe aqui o seu client/service do Omie
// import { omieClient } from "../services/omie/omieClient";

const router = Router();

function requireAdmin(req: any, res: any, next: any) {
  const got = String(req.headers["x-admin-key"] || "");
  const expected = String(process.env.ADMIN_API_KEY || "");
  if (!expected) return res.status(500).json({ ok: false, error: "ADMIN_API_KEY não configurada" });
  if (!got || got !== expected) return res.status(401).json({ ok: false, error: "Unauthorized" });
  return next();
}

function toISO(v: any): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * POST /cron/sync-omie-mf-movements
 * - Busca movimentos novos/alterados no Omie desde o último updated_at gravado
 * - UPSERT por cod_mov_cc (chave única)
 */
router.post("/cron/sync-omie-mf-movements", requireAdmin, async (_req, res) => {
  try {
    // 1) checkpoint: maior updated_at local
    const { data: maxRow, error: maxErr } = await supabaseAdmin
      .from("omie_mf_movements")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxErr) throw new Error(maxErr.message);

    // fallback: se tabela vazia, buscar últimos X dias
    const lastUpdatedAt =
      maxRow?.updated_at ? new Date(maxRow.updated_at) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // 2) buscar no Omie movimentos alterados desde lastUpdatedAt
    // ⚠️ aqui você liga com o seu serviço Omie.
    // A função abaixo é um placeholder: implemente conforme sua integração.
    const items = await fetchOmieMfMovementsUpdatedSince(lastUpdatedAt);

    let fetched = items.length;
    let upserted = 0;
    let errors = 0;

    // 3) montar payload e upsert em lotes
    const BATCH = 200;
    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH).map((m: any) => {
        const cod_mov_cc = Number(m.cod_mov_cc ?? m.nCodMovCC ?? m.codMovCC);
        return {
          cod_mov_cc,
          mf_key: String(m.mf_key ?? ""),
          tp_lancamento: String(m.tp_lancamento ?? m.cTpLancamento ?? ""),
          natureza: String(m.natureza ?? m.cNatureza ?? ""),
          cod_titulo: m.cod_titulo ?? m.nCodTitulo ?? null,
          cod_baixa: m.cod_baixa ?? m.nCodBaixa ?? null,
          cod_cliente: m.cod_cliente ?? m.nCodCliente ?? null,
          cod_projeto: m.cod_projeto ?? m.nCodProjeto ?? null,
          cod_categoria: m.cod_categoria ?? m.nCodCategoria ?? null,
          dt_emissao: toISO(m.dt_emissao ?? m.dDtEmissao),
          dt_venc: toISO(m.dt_venc ?? m.dDtVenc),
          dt_pagamento: toISO(m.dt_pagamento ?? m.dDtPagamento),
          valor: Number(m.valor ?? m.nValor ?? 0),
          status: String(m.status ?? m.cStatus ?? ""),
          descricao: String(m.descricao ?? m.cDescricao ?? ""),
          raw_payload: m, // guarda o payload bruto (jsonb)
          updated_at: toISO(m.updated_at ?? m.dDtAlt ?? new Date()),
        };
      }).filter((x: any) => x.cod_mov_cc && Number.isFinite(x.cod_mov_cc));

      if (!batch.length) continue;

      const { error } = await supabaseAdmin
        .from("omie_mf_movements")
        .upsert(batch, { onConflict: "cod_mov_cc" });

      if (error) {
        errors++;
        console.log("[cron/omie-mf-movements] upsert batch error:", error.message);
      } else {
        upserted += batch.length;
      }
    }

    return res.json({
      ok: true,
      checkpoint_used: lastUpdatedAt.toISOString(),
      fetched,
      upserted,
      errors,
    });
  } catch (e: any) {
    console.log("[cron/sync-omie-mf-movements] error:", e?.message || e);
    return res.status(500).json({ ok: false, error: e?.message || "Erro interno" });
  }
});

// ⛔ Placeholder: substitua pela sua chamada real ao Omie
async function fetchOmieMfMovementsUpdatedSince(_since: Date): Promise<any[]> {
  // Exemplo do que você vai fazer aqui:
  // return omieClient.listMfMovements({ updated_after: since, page: 1, per_page: 200, ... });
  return [];
}

export default router;
