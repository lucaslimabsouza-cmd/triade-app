// Backend/scripts/debugOmieMovements.js
const path = require("path");
const fs = require("fs");

// 🔑 Carrega variáveis do .env (para OMIE_APP_KEY/SECRET, etc.)
require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
});

const { callOmie } = require("../services/omieClient");

// Endpoint e método do EXTRATO FINANCEIRO (listaMovimentos)
const OMIE_EXTRATO_ENDPOINT = "financas/extrato/";
const OMIE_EXTRATO_METHOD = "ListarExtrato";

// 🏦 As três contas que queremos buscar
const CONTAS = [
  { nCodCC: 10788136271, nome: "Caixinha" },
  { nCodCC: 10788136372, nome: "OmieCASH" },
  { nCodCC: 10788819125, nome: "Santander" },
];

// Formata data no padrão dd/MM/aaaa
function formatDateBR(date) {
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const y = date.getFullYear().toString();
  return `${d}/${m}/${y}`;
}

/**
 * Gera um CSV com todos os campos dos movimentos retornados pelo Omie
 * para uma conta específica.
 */
function dumpMovementsToCsv(movimentos, conta, dInicial, dFinal) {
  try {
    if (!movimentos || movimentos.length === 0) {
      console.log(
        `📂 Nenhum movimento para gerar CSV (conta ${conta.nCodCC} - ${conta.nome}) no período ${dInicial} a ${dFinal}.`
      );
      return;
    }

    const headers = Array.from(
      new Set(movimentos.flatMap((mov) => Object.keys(mov || {})))
    );

    const lines = [];

    // Cabeçalho
    lines.push(headers.join(";"));

    // Linhas
    for (const mov of movimentos) {
      const row = headers
        .map((h) => {
          let val = mov[h];

          if (val === null || val === undefined) return "";

          if (typeof val === "object") {
            // se vier objeto/array, transforma em JSON
            return JSON.stringify(val).replace(/;/g, ",");
          }

          return String(val).replace(/;/g, ",");
        })
        .join(";");

      lines.push(row);
    }

    const dir = path.join(__dirname, "..", "data");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // monta um nome de arquivo limpinho com código + apelido
    const safeName = conta.nome.replace(/[^a-zA-Z0-9_-]+/g, "");
    const filePath = path.join(
      dir,
      `debug_omie_listaMovimentos_extrato_${conta.nCodCC}_${safeName}.csv`
    );

    fs.writeFileSync(filePath, lines.join("\n"), "utf8");

    console.log(
      `📂 CSV de debug gerado para conta ${conta.nCodCC} - ${conta.nome} com ${movimentos.length} linhas em: ${filePath}`
    );
  } catch (err) {
    console.error(
      `💥 Erro ao gerar CSV de debug dos movimentos do Omie (extrato) para conta ${conta.nCodCC} - ${conta.nome}:`,
      err.message || err
    );
  }
}

async function extratoConta(conta) {
  const hoje = new Date();
  const dInicial = "01/01/2023";
  const dFinal = formatDateBR(hoje);

  console.log("─────────────────────────────────────────────");
  console.log(
    `🔎 Chamando Extrato (ListarExtrato) para conta ${conta.nCodCC} - ${conta.nome}`
  );
  console.log(`🏦 nCodCC = ${conta.nCodCC}`);
  console.log(`📅 Período: de ${dInicial} até ${dFinal}`);

  const params = {
    nCodCC: conta.nCodCC,
    cCodIntCC: "",
    dPeriodoInicial: dInicial,
    dPeriodoFinal: dFinal,
  };

  const response = await callOmie(
    OMIE_EXTRATO_ENDPOINT,
    OMIE_EXTRATO_METHOD,
    params
  );

  console.log(
    "🧾 Top-level keys da resposta:",
    response ? Object.keys(response) : "sem resposta"
  );

  const movimentos =
    response?.listaMovimentos ||
    response?.lista_movimentos ||
    response?.movimentos ||
    [];

  console.log(
    `📊 Total de lançamentos em listaMovimentos (conta ${conta.nCodCC} - ${conta.nome}): ${movimentos.length}`
  );

  if (movimentos.length > 0) {
    console.log(
      "🔎 Exemplo de movimento bruto (primeiro item de listaMovimentos):"
    );
    console.log(movimentos[0]);
  }

  dumpMovementsToCsv(movimentos, conta, dInicial, dFinal);
}

async function main() {
  try {
    for (const conta of CONTAS) {
      try {
        await extratoConta(conta);
      } catch (errConta) {
        console.error(
          `💥 Erro ao obter extrato da conta ${conta.nCodCC} - ${conta.nome}:`,
          errConta?.response?.data || errConta.message || errConta
        );
      }
    }
  } catch (err) {
    console.error(
      "💥 Erro geral ao chamar Extrato Financeiro (ListarExtrato):",
      err?.response?.data || err.message || err
    );
  }
}

main();
