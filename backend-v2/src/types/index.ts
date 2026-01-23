// Tipos principais da aplicação

export interface OmieParty {
  id: string;
  name: string;
  cpf_cnpj: string;
  omie_code: string | null;
}

export interface Operation {
  id: string;
  code: string;
  name: string;
  city: string | null;
  state: string | null;
  status: "em_andamento" | "concluida";
  expected_roi: number | null;
  amountInvested: number;
  realizedProfit: number;
  totalCosts: number;
  estimated_term_months: number | null;
  realized_term_months: number | null;
  photo_url: string | null;
  auction_date: string | null;
  itbi_date: string | null;
  deed_date: string | null;
  registry_date: string | null;
  vacancy_date: string | null;
  construction_date: string | null;
  listed_to_broker_date: string | null;
  sale_contract_date: string | null;
  sale_receipt_date: string | null;
  documents: {
    cartaArrematacao: string;
    matriculaConsolidada: string;
    contratoScp: string;
  };
}

export interface Notification {
  id: number;
  source_id: number;
  datahora: string;
  codigo_imovel: string | null;
  mensagem_curta: string;
  mensagem_detalhada: string | null;
  tipo: string | null;
  enviar_push: boolean;
  push_sent_at: string | null;
}

export interface JwtPayload {
  party_id: string;
  cpf_cnpj: string;
}

export interface OmieMfMovement {
  mf_key: string;
  tp_lancamento: string;
  natureza: string;
  cod_cliente: string | null;
  cod_projeto: string | null;
  cod_categoria: string | null;
  valor: number | null;
  dt_emissao: string | null;
  dt_venc: string | null;
  dt_pagamento: string | null;
}

export interface ApiResponse<T = any> {
  ok: boolean;
  error?: string;
  data?: T;
}
