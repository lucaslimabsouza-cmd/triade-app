import { FinancialEvent } from "../domain/financialEvents";
import { OperationSummary } from "../domain/operations";
import { buildOperationSummaries } from "./operationCalculator";

// Simulação das operações
const RAW_OPERATIONS = [
  {
    id: "1",
    propertyName: "Apartamento 302 - Vila Mariana",
    city: "São Paulo",
    state: "SP",
    status: "em_andamento" as const,
    expectedReturn: 25000,
  },
  {
    id: "2",
    propertyName: "Casa - Jardim Europa",
    city: "Curitiba",
    state: "PR",
    status: "concluida" as const,
  },
];

// Simulação dos eventos financeiros (futuro: OMIE)
const MOCK_EVENTS: FinancialEvent[] = [
  {
    id: "e1",
    operationId: "1",
    type: "APORTE",
    amount: 80000,
    date: "2025-01-10",
  },
  {
    id: "e2",
    operationId: "2",
    type: "APORTE",
    amount: 60000,
    date: "2025-02-01",
  },
  {
    id: "e3",
    operationId: "2",
    type: "DISTRIBUICAO_LUCROS",
    amount: 22000,
    date: "2025-04-01",
  },
];

export async function getOperationSummariesFromOmie(): Promise<OperationSummary[]> {
  // futuro: chamar OMIE + DB
  return buildOperationSummaries(RAW_OPERATIONS, MOCK_EVENTS);
}
