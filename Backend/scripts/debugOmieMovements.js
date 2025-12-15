
// Backend/scripts/debugOmieMovements.js
const path = require("path");
const fs = require("fs");

// 🔑 Carrega variáveis do .env
require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
});

const { callOmie } = require("../services/omieClient");

// Endpoint e método do EXTRATO FINANCEIRO (listaMovimentos)
const OMIE_EXTRATO_ENDPOINT = "financas/extrato/";
const OMIE_EXTRATO_METHOD = "ListarExtrato";

// Lê o código da conta corrente do .env
const NCODCC = Number(process.env.OMIE_NCODCC || 0);

// Formata data no padrão dd/MM/aaaa
function formatDateBR(date) {
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const y = date.getFullYear().toString();
  return `${d}/${m}/${y}`;
}

/**
 * Gera um CSV com todos os campos dos movimentos retornados pelo Omie
 */
function dumpMovementsToCsv(movimentos) {
  try {
    if (!movimentos || movimentos.length === 0) {
      console.log("📂 Nenhum movimento para gerar CSV de debug.");
      return;
    }

    // 🔧 AQUI estava o erro: estava usando "m" em vez de "mov"
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

    const filePath = path.join(
      dir,
      "debug_omie_listaMovimentos_extrato.csv"
    );
    fs.writeFileSync(filePath, lines.join("\n"), "utf8");

    console.log(
      `📂 CSV de debug gerado com ${movimentos.length} linhas em: ${filePath}`
    );
  } catch (err) {
    console.error(
      "💥 Erro ao gerar CSV de debug dos movimentos do Omie (extrato):",
      err.message || err
    );
  }
}

async function main() {
  try {
    if (!NCODCC || Number.isNaN(NCODCC)) {
      console.error(
        "💥 OMIE_NCODCC não está definido ou não é numérico no .env. " +
          "Edite o arquivo Backend/.env e adicione, por exemplo: OMIE_NCODCC=10788819125"
      );
      return;
    }

    const hoje = new Date();
    const dInicial = "01/01/2023";
    const dFinal = formatDateBR(hoje);

    console.log("🔎 Chamando Omie Extrato Financeiro (ListarExtrato)...");
    console.log(`🏦 Usando nCodCC = ${NCODCC}`);
    console.log(`📅 Período: de ${dInicial} até ${dFinal}`);

    const params = {
      nCodCC: NCODCC,
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
      "🧾 Resposta bruta do Omie (top-level keys):",
      response ? Object.keys(response) : "sem resposta"
    );

    const movimentos =
      response?.listaMovimentos ||
      response?.lista_movimentos ||
      response?.movimentos ||
      [];

    console.log(
      `📊 Total de lançamentos em listaMovimentos: ${movimentos.length}`
    );

    if (movimentos.length > 0) {
      console.log(
        "🔎 Exemplo de movimento bruto (primeiro item de listaMovimentos):"
      );
      console.log(movimentos[0]);
    }

    dumpMovementsToCsv(movimentos);
  } catch (err) {
    console.error(
      "💥 Erro ao chamar Extrato Financeiro (ListarExtrato):",
      err?.response?.data || err.message || err
    );
  }
}

main();
