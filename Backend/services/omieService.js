// Backend/services/omieClient.js
const axios = require("axios");

const OMIE_BASE_URL = process.env.OMIE_BASE_URL || "https://app.omie.com.br/api/v1";
const OMIE_APP_KEY = process.env.OMIE_APP_KEY || "";
const OMIE_APP_SECRET = process.env.OMIE_APP_SECRET || "";

/**
 * Client genérico para chamar a OMIE.
 * Exemplo OMIE clássico:
 *  - POST em /financas/contareceber/
 *  - body:
 *    { "call": "ListarContasReceber", "app_key": "...", "app_secret": "...", "param": [ {...} ] }
 */
async function callOmie(endpointPath, call, paramArray) {
  if (!OMIE_APP_KEY || !OMIE_APP_SECRET) {
    console.warn("⚠️ OMIE_APP_KEY ou OMIE_APP_SECRET não configurados. Usando MOCK.");
    throw new Error("OMIE não configurada");
  }

  const url = `${OMIE_BASE_URL}/${endpointPath.replace(/^\/+/, "")}`;

  const body = {
    call,
    app_key: OMIE_APP_KEY,
    app_secret: OMIE_APP_SECRET,
    param: paramArray,
  };

  const response = await axios.post(url, body, {
    headers: { "Content-Type": "application/json" },
  });

  return response.data;
}

module.exports = {
  callOmie,
};
