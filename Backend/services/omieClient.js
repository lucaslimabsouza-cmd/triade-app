// Backend/services/omieClient.js
const axios = require("axios");

// 🧭 Base padrão da API Omie (RAIZ, sem /financas/mf ainda)
const OMIE_BASE_URL =
  process.env.OMIE_BASE_URL || "https://app.omie.com.br/api/v1";

const OMIE_APP_KEY = process.env.OMIE_APP_KEY;
const OMIE_APP_SECRET = process.env.OMIE_APP_SECRET;

if (!OMIE_APP_KEY || !OMIE_APP_SECRET) {
  console.warn(
    "⚠️ OMIE_APP_KEY ou OMIE_APP_SECRET não configurados no .env. " +
      "Integração com Omie ficará inativa."
  );
}

/**
 * Monta a URL final para chamada da API do Omie.
 *
 * - Se o caller passar um caminho relativo (ex.: "financas/mf/"):
 *   → monta em cima de https://app.omie.com.br/api/v1
 * - Se passar já começando com "http":
 *   → usa direto (permite sobrescrever totalmente, se quiser).
 */
function buildOmieUrl(endpoint) {
  if (!endpoint) {
    // se ninguém passar endpoint, usamos a raiz de API v1
    return OMIE_BASE_URL.replace(/\/+$/, "");
  }

  // Se já for URL completa (http...), usa direto
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    return endpoint;
  }

  // Garante que não duplica barra
  const base = OMIE_BASE_URL.replace(/\/+$/, ""); // remove / no final
  const path = endpoint.replace(/^\/+/, ""); // remove / no começo

  return `${base}/${path}`;
}

/**
 * Chamada genérica à API do Omie.
 *
 * Exemplo de uso:
 *  callOmie("financas/mf/", "ListarMovimentos", { nPagina: 1, nRegPorPagina: 500 })
 */
async function callOmie(endpoint, call, params) {
  if (!OMIE_APP_KEY || !OMIE_APP_SECRET) {
    // Sem credenciais, não chama nada
    console.warn(
      "⚠️ Tentativa de chamar Omie sem OMIE_APP_KEY/OMIE_APP_SECRET configurados."
    );
    return null;
  }

  const url = buildOmieUrl(endpoint);

  const payload = {
    call,
    app_key: OMIE_APP_KEY,
    app_secret: OMIE_APP_SECRET,
    param: [params || {}],
  };

  console.log("🌐 Chamando Omie:", {
    url,
    call,
    hasParams: !!params,
  });

  const { data } = await axios.post(url, payload, {
    headers: { "Content-Type": "application/json" },
  });

  return data;
}

/**
 * Atalho específico para Movimento Financeiro (financas/mf/).
 * Assim não tem erro de endpoint nesse módulo.
 *
 * Exemplo:
 *   callOmieFinancasMF("ListarMovimentos", { nPagina: 1, nRegPorPagina: 500 })
 */
async function callOmieFinancasMF(call, params) {
  return callOmie("financas/mf/", call, params);
}

module.exports = {
  callOmie,
  callOmieFinancasMF,
};
