"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.callOmie = callOmie;
const axios_1 = __importStar(require("axios"));
const logger_1 = require("../../lib/logger");
const OMIE_BASE_URL = process.env.OMIE_BASE_URL || "https://app.omie.com.br/api/v1";
const OMIE_APP_KEY = process.env.OMIE_APP_KEY || "";
const OMIE_APP_SECRET = process.env.OMIE_APP_SECRET || "";
const DEFAULT_TIMEOUT = 30000; // 30 segundos
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1 segundo base
/**
 * Chama API do Omie com retry automático e timeout
 */
async function callOmie(endpointPath, call, paramArray, options) {
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
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            logger_1.logger.debug(`Chamando Omie API: ${call}`, { attempt, url });
            const { data } = await axios_1.default.post(url, body, {
                headers: { "Content-Type": "application/json" },
                timeout,
            });
            logger_1.logger.debug(`Omie API sucesso: ${call}`, { attempt });
            return data;
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            const isAxiosError = error instanceof axios_1.AxiosError;
            const isTimeout = isAxiosError && error.code === "ECONNABORTED";
            const isNetworkError = isAxiosError && !error.response;
            // Não tenta novamente em erros 4xx (erros do cliente)
            if (isAxiosError && error.response && error.response.status >= 400 && error.response.status < 500) {
                logger_1.logger.error(`Omie API erro do cliente: ${call}`, error, {
                    status: error.response.status,
                    data: error.response.data,
                });
                throw error;
            }
            // Última tentativa: lança o erro
            if (attempt === maxRetries) {
                logger_1.logger.error(`Omie API falhou após ${maxRetries} tentativas: ${call}`, error, {
                    attempt,
                    isTimeout,
                    isNetworkError,
                });
                throw error;
            }
            // Calcula delay exponencial: 1s, 2s, 4s...
            const delay = RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
            logger_1.logger.warn(`Omie API tentativa ${attempt}/${maxRetries} falhou, tentando novamente em ${delay}ms`, {
                call,
                error: lastError.message,
            });
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
    throw lastError || new Error("Erro desconhecido ao chamar Omie API");
}
