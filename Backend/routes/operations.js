// Backend/routes/operations.js
const express = require("express");
const router = express.Router();

const { loadOperationsFromExcel } = require("../services/excelOperations");
const {
  getOperationCostsFromOmie,
  getInvestorAmountForProject,
  getRealizedProfitForProject,
} = require("../services/omieCostsService");
const { getLastLoginCpf } = require("../sessionStore");

// Lista todas as operações (para a tela "Minhas operações")
router.get("/", async (req, res) => {
  try {
    const operations = await loadOperationsFromExcel();

    if (!operations) {
      return res.status(500).json({ error: "Erro ao carregar operações" });
    }

    const cpfRaw = req.query.cpf || getLastLoginCpf() || null;
    let cpfFilter = cpfRaw ? String(cpfRaw).replace(/[^\d]/g, "") : null;

    const isGlobalAdmin = cpfFilter === "00000000000";

    console.log(
      "📥 /operations chamado com CPF filtro:",
      isGlobalAdmin ? "ADMIN_00000000000" : cpfFilter || "SEM_FILTRO"
    );

    const mappedRaw = await Promise.all(
      operations.map(async (op) => {
        const propertyName = op.propertyName;

        let omieCosts = 0;
        let amountInvested = op.amountInvested ?? 0;
        let realizedProfitOmie = 0;

        // 1) Custos do projeto
        try {
          const omieResult = await getOperationCostsFromOmie(op.id, propertyName);
          omieCosts = omieResult?.totalCosts ?? 0;
        } catch (err) {
          console.error(
            `⚠️ Erro ao enriquecer custos da operação ${op.id}:`,
            err.message || err
          );
        }

        // 2) Aporte (investimento) por CPF
        if (cpfFilter) {
          try {
            console.log(
              `🔎 Calculando aporte (cpf=${cpfFilter}) para o projeto "${propertyName}"`
            );
            amountInvested = await getInvestorAmountForProject(
              cpfFilter,
              propertyName
            );
          } catch (err) {
            console.error(
              `⚠️ Erro ao calcular aporte do CPF ${cpfFilter} na operação ${op.id}:`,
              err.message || err
            );
            amountInvested = 0;
          }
        }

        // 3) Lucro realizado vindo do Omie (Distribuição de Lucros por CPF)
        try {
          realizedProfitOmie = await getRealizedProfitForProject(
            propertyName,
            cpfFilter || null
          );
        } catch (err) {
          console.error(
            `⚠️ Erro ao calcular lucro realizado no Omie para operação ${op.id}:`,
            err.message || err
          );
          realizedProfitOmie = 0;
        }

        const totalCostsPlanilha = op.totalCosts ?? 0;
        const totalCosts = totalCostsPlanilha + omieCosts;

        // ✅ NOVO: repassa documentos vindos do Excel (se existir)
        const documents = op.documents ?? {
          cartaArrematacao: null,
          matriculaConsolidada: null,
        };

        const resultadoOperacao = {
          id: op.id,
          propertyName: op.propertyName,
          city: op.city,
          state: op.state,
          status: op.status,
          expectedReturn: op.expectedReturn ?? 0,
          roi: Number(op.targetRoi ?? 0), // garante número
          amountInvested: amountInvested || 0,
          realizedProfit: realizedProfitOmie,
          totalCosts,
          estimatedTerm: op.estimatedTerm ?? null,
          realizedTerm: op.realizedTerm ?? null,
          timeline: op.timeline ?? {},
          documents, // ✅ aqui está o que você quer
        };

        // filtro: se for CPF (não admin) e não investiu, não retorna a operação
        if (
          cpfFilter &&
          !isGlobalAdmin &&
          (!amountInvested || amountInvested <= 0)
        ) {
          return null;
        }

        return resultadoOperacao;
      })
    );

    const mapped = mappedRaw.filter((op) => op !== null);

    console.log(
      `📤 /operations respondendo ${mapped.length} operações (filtro CPF=${
        isGlobalAdmin ? "ADMIN_00000000000" : cpfFilter || "SEM_FILTRO"
      })`
    );

    res.json(mapped);
  } catch (err) {
    console.error("💥 Erro na rota /operations:", err.message || err);
    res.status(500).json({ error: "Erro interno ao carregar operações" });
  }
});

// Custos detalhados de uma operação específica
router.get("/:id/costs", async (req, res) => {
  try {
    const { id } = req.params;

    const operations = await loadOperationsFromExcel();
    if (!operations) {
      return res
        .status(500)
        .json({ error: "Erro ao carregar operações para custos." });
    }

    const op = operations.find((o) => String(o.id) === String(id));

    if (!op) {
      return res.status(404).json({ error: "Operação não encontrada." });
    }

    const propertyName = op.propertyName;

    const omieResult = await getOperationCostsFromOmie(op.id, propertyName);

    const totalCostsPlanilha = op.totalCosts ?? 0;
    const totalCosts = totalCostsPlanilha + (omieResult?.totalCosts ?? 0);

    res.json({
      id: op.id,
      propertyName: op.propertyName,
      totalCosts,
      categories: omieResult?.categories || [],
      items: omieResult?.items || [],
    });
  } catch (err) {
    console.error(
      "💥 Erro na rota /operations/:id/costs:",
      err.message || err
    );
    res
      .status(500)
      .json({ error: "Erro ao carregar custos detalhados da operação." });
  }
});

module.exports = router;
