export type FinancialEventType =
  | "APORTE"
  | "DEVOLUCAO_CAPITAL"
  | "DISTRIBUICAO_LUCROS";

export interface FinancialEvent {
  id: string;
  operationId: string; // qual operação Triade (imóvel)
  investorId?: string; // pra futuro relatório por investidor
  type: FinancialEventType;
  amount: number; // sempre positivo
  date: string; // ISO ex: "2025-12-05"
  source?: "OMIE" | "MANUAL";
}
