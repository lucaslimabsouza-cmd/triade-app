export type OperationStatus = "em_andamento" | "concluida";

export interface OperationSummary {
  id: string;
  propertyName: string;
  city: string;
  state: string;
  status: OperationStatus;

  amountInvested: number;      // valor investido líquido
  expectedReturn?: number;     // pra operações em andamento
  realizedProfit?: number;     // lucro pra concluídas
  roi: number;                 // em %, ex: 31.25
}
