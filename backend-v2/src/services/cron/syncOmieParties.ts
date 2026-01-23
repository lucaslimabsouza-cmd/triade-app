import { supabaseAdmin } from "../../lib/supabase";
import { getLastSyncAt, setLastSyncAt } from "./syncState";
import { omieFetchAllPaged } from "../omie/omiePaged";
import { logger } from "../../lib/logger";

const SOURCE = "omie_parties";

export async function syncOmieParties(options?: { fullSync?: boolean }) {
  const last = options?.fullSync ? null : await getLastSyncAt(SOURCE);
  const since = last ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  logger.info(`[syncOmieParties] Iniciando sincronização`, { fullSync: options?.fullSync, last, since });

  const { items, pages } = await omieFetchAllPaged<any>({
    endpointPath: "/geral/clientes/",
    call: "ListarClientes",
    baseParams: {
      registros_por_pagina: 200,
      // dt_alt_de: since, // Comentado porque sempre busca todos os clientes
    },
  });

  logger.info(`[syncOmieParties] Buscou ${items.length} itens em ${pages} páginas`);

  // Se não retornou nenhum item, loga um exemplo do primeiro item para debug
  if (items.length > 0 && items.length <= 3) {
    logger.info(`[syncOmieParties] Exemplo de item retornado:`, { item: items[0] });
  }

  const payloads = items
    .map((x) => {
      // Tenta vários campos possíveis para o código do cliente
      const omie_code = String(
        x.codigo_cliente_omie ?? 
        x.nCodCliente ?? 
        x.codigo_cliente ?? 
        x.codigo ?? 
        x.omie_code ?? 
        x.id ??
        ""
      ).trim();

      // Tenta vários campos possíveis para o nome
      const name = x.nome_fantasia ?? x.razao_social ?? x.nome ?? x.cNome ?? null;
      
      // Tenta vários campos possíveis para CPF/CNPJ
      const cpf_cnpj = x.cnpj_cpf ?? x.cpf_cnpj ?? x.cCnpjCpf ?? x.cnpj ?? x.cpf ?? null;

      // Tenta vários campos possíveis para email
      const email = x.email ?? x.e_mail ?? x.email_principal ?? x.cEmail ?? x.email_financeiro ?? null;

      return {
        omie_code,
        name,
        cpf_cnpj,
        email,
        raw_payload: x,
        updated_at: new Date().toISOString(),
      };
    })
    .filter((p) => {
      if (!p.omie_code) {
        logger.warn(`[syncOmieParties] Item sem omie_code ignorado:`, { raw_payload: p.raw_payload });
        return false;
      }
      return true;
    });

  logger.info(`[syncOmieParties] Processou ${payloads.length} payloads válidos de ${items.length} itens`);

  if (payloads.length) {
    const { error, data } = await supabaseAdmin
      .from("omie_parties")
      .upsert(payloads, { onConflict: "omie_code" });
    
    if (error) {
      logger.error(`[syncOmieParties] Erro ao fazer upsert:`, error);
      throw new Error(error.message);
    }
    
    logger.info(`[syncOmieParties] Upsert realizado com sucesso: ${payloads.length} registros`);
  } else {
    logger.warn(`[syncOmieParties] Nenhum payload válido para inserir/atualizar`);
  }

  const newSyncAt = new Date().toISOString();
  await setLastSyncAt(SOURCE, newSyncAt);

  logger.info(`[syncOmieParties] Sincronização concluída`, { 
    fetched: items.length, 
    pages, 
    upserted: payloads.length, 
    since, 
    newSyncAt 
  });

  return { fetched: items.length, pages, upserted: payloads.length, since, newSyncAt };
}
