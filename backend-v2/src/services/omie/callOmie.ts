import axios, { AxiosError } from "axios";
import { logger } from "../../lib/logger";

const OMIE_BASE_URL = process.env.OMIE_BASE_URL || "https://app.omie.com.br/api/v1";
const OMIE_APP_KEY = process.env.OMIE_APP_KEY || "";
const OMIE_APP_SECRET = process.env.OMIE_APP_SECRET || "";

const DEFAULT_TIMEOUT = 30000; // 30 segundos
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1 segundo base

/**
 * Chama API do Omie com retry automático e timeout
 */
export async function callOmie(
  endpointPath: string,
  call: string,
  paramArray: any[],
  options?: { timeout?: number; maxRetries?: number }
): Promise<any> {
  if (!OMIE_APP_KEY || !OMIE_APP_SECRET) {
    throw new Error("OMIE_APP_KEY ou OMIE_APP_SECRET não configurados no .env");
  }

  const base = OMIE_BASE_URL.replace(/\/+$/, "");
  const path = endpointPath.replace(/^\/+/, "");
  const url = `${base}/${path}`;

  const body = {
    call,
    app_key: OMIE_APP_KEY,
    app_secret: OMIE_APP_SECRET,
    param: paramArray,
  };

  const timeout = options?.timeout || DEFAULT_TIMEOUT;
  const maxRetries = options?.maxRetries || MAX_RETRIES;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.debug(`Chamando Omie API: ${call}`, { attempt, url });

      const { data } = await axios.post(url, body, {
        headers: { "Content-Type": "application/json" },
        timeout,
      });

      logger.debug(`Omie API sucesso: ${call}`, { attempt });
      return data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const isAxiosError = error instanceof AxiosError;
      const isTimeout = isAxiosError && error.code === "ECONNABORTED";
      const isNetworkError = isAxiosError && !error.response;

      // Não tenta novamente em erros 4xx (erros do cliente)
      if (isAxiosError && error.response && error.response.status >= 400 && error.response.status < 500) {
        logger.error(`Omie API erro do cliente: ${call}`, error, {
          status: error.response.status,
          data: error.response.data,
        });
        throw error;
      }

      // Última tentativa: lança o erro
      if (attempt === maxRetries) {
        logger.error(`Omie API falhou após ${maxRetries} tentativas: ${call}`, error, {
          attempt,
          isTimeout,
          isNetworkError,
        });
        throw error;
      }

      // Calcula delay exponencial: 1s, 2s, 4s...
      const delay = RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
      logger.warn(`Omie API tentativa ${attempt}/${maxRetries} falhou, tentando novamente em ${delay}ms`, {
        call,
        error: lastError.message,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error("Erro desconhecido ao chamar Omie API");
}
