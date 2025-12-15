import { FinancialEvent } from "../domain/financialEvents";
import { OperationSummary } from "../domain/operations";

interface RawOperation {
  id: string;
  propertyName: string;
  city: string;
  state: string;
  status: "em_andamento" | "concluida";
  expectedReturn?: number;
}

export function buildOperationSummaries(
  operations: RawOperation[],
  events: FinancialEvent[]
): OperationSummary[] {
  return operations.map((operation) => {
    const opEvents = events.filter(
      (e) => e.operationId === operation.id
    );

    const aporte = sumByType(opEvents, "APORTE");
    const devolucaoCapital = sumByType(opEvents, "DEVOLUCAO_CAPITAL");
    const distribuicaoLucros = sumByType(opEvents, "DISTRIBUICAO_LUCROS");

    // SUA FÓRMULA:
    // valor investido = recebimento de investidores
    //                  - devolução de capital
    //                  - distribuição de lucros
    const amountInvested =
      aporte - devolucaoCapital - distribuicaoLucros;

    // Tudo que já voltou:
    const totalDevolvido = devolucaoCapital + distribuicaoLucros;

    // Lucro realizado = (voltou) - (entrou)
    const realizedProfit = totalDevolvido - aporte;

    const roi =
      amountInvested > 0 ? (realizedProfit / amountInvested) * 100 : 0;

    return {
      id: operation.id,
      propertyName: operation.propertyName,
      city: operation.city,
      state: operation.state,
      status: operation.status,
      amountInvested: round(amountInvested),
      expectedReturn: operation.expectedReturn,
      realizedProfit:
        operation.status === "concluida" ? round(realizedProfit) : undefined,
      roi: round(roi),
    };
  });
}

function sumByType(
  events: FinancialEvent[],
  type: FinancialEvent["type"]
): number {
  return events
    .filter((e) => e.type === type)
    .reduce((acc, e) => acc + e.amount, 0);
}

function round(value: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
