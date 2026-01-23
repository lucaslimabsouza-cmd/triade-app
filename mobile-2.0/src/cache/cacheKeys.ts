export const CACHE_KEYS = {
  ME: "me",
  OPERATIONS: "operations:list",
  NOTIFICATIONS: (cpf: string) => `notifications:${cpf}`,
  OP_COSTS: (operationId: string) => `operation-costs:${operationId}`,
  OP_DETAILS: (operationId: string) => `operation:${operationId}`,
  OP_FINANCIAL: (operationId: string, roiExpectedPercent?: number) =>
    roiExpectedPercent !== undefined
      ? `operation-financial:${operationId}:${roiExpectedPercent}`
      : `operation-financial:${operationId}`,
};
