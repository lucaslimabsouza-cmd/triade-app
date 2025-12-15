// Backend/services/financialEvents.js

/**
 * TIPOS:
 * - APORTE            → recebimento de investidores
 * - DEVOLUCAO_CAPITAL → devolução de capital ao investidor
 * - DISTRIBUICAO_LUCROS → distribuição de lucros
 *
 * Por enquanto: só MOCK, sem OMIE.
 */

const FINANCIAL_EVENTS = [
  // OPERAÇÃO 1
  {
    id: "e1",
    operationId: "1",
    type: "APORTE",
    amount: 50000, // aqui você pode testar: mude o valor e vê no app
    date: "2025-01-10",
  },

  // OPERAÇÃO 2
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

/**
 * Hoje: sempre usa só o MOCK.
 * Depois, quando quiser plugar OMIE,
 * a gente altera essa função.
 */
async function getFinancialEventsForOperations(operationIds = []) {
  if (operationIds.length === 0) {
    return FINANCIAL_EVENTS;
  }

  return FINANCIAL_EVENTS.filter((e) =>
    operationIds.includes(e.operationId)
  );
}

module.exports = {
  getFinancialEventsForOperations,
};
