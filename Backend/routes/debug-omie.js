// Backend/routes/debug-omie.js
const express = require("express");
const router = express.Router();
const { callOmie } = require("../services/omieClient");

/**
 * EXEMPLO 1 – Contas a pagar
 * (método que a gente já sabe que funciona)
 *
 * Acessar em:
 *   GET /debug-omie/contas-pagar
 */
router.get("/contas-pagar", async (req, res) => {
  try {
    const data = await callOmie(
      "financas/contapagar/",
      "ListarContasPagar",
      {
        pagina: 1,
        registros_por_pagina: 50,
        apenas_importado_api: "N",
      }
    );

    // devolve TUDO que o Omie respondeu, sem filtro
    res.json(data);
  } catch (error) {
    console.error("Erro ao chamar Omie (contas-pagar):", error);
    res.status(500).json({ error: "Erro ao chamar Omie (contas-pagar)" });
  }
});

/**
 * MODELO para você duplicar depois:
 *
 * router.get("/clientes", async (req, res) => {
 *   try {
 *     const data = await callOmie(
 *       "CAMINHO/DO/RECURSO/",
 *       "NomeDoMetodoOmie",
 *       { ...paramsQueADocPedir }
 *     );
 *     res.json(data);
 *   } catch (error) {
 *     console.error("Erro ao chamar Omie (clientes):", error);
 *     res.status(500).json({ error: "Erro ao chamar Omie (clientes)" });
 *   }
 * });
 *
 * Mesma coisa pra conciliação, extrato, etc.
 */

module.exports = router;
