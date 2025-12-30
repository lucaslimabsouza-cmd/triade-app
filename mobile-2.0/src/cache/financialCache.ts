import { api } from "../services/api";
import { getOrFetch } from "./memoryCache";

const TTL_FINANCIAL = 3 * 60 * 1000; // 3 minutos

export function getOperationFinancial(
  operationId: string,
  roiExpectedPercent: number,
  options?: { force?: boolean }
) {
  const key = `operation-financial:${operationId}:${roiExpectedPercent}`;

  return getOrFetch(
    key,
    async () => {
      const res = await api.get(`/operation-financial/${operationId}`, {
        params: { roi_expected: roiExpectedPercent },
        timeout: 30000,
      });
      return res.data;
    },
    {
      ttlMs: TTL_FINANCIAL,
      force: options?.force,
    }
  );
}
