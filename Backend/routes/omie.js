// Backend/routes/omie.js
const express = require("express");
const router = express.Router();
const { listarClientes } = require("../services/omieService");

// GET /omie/clients
router.get("/clients", async (req, res) => {
  try {
    const pagina = Number(req.query.pagina) || 1;
    const registros = Number(req.query.registros) || 50;

    const resultado = await listarClientes(pagina, registros);
    res.json(resultado);
  } catch (error) {
    console.error(
      "Erro ao buscar clientes na OMIE:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Erro ao buscar clientes na OMIE" });
  }
});

module.exports = router;
