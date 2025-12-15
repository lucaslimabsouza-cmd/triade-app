// Backend/scripts/exportExtratoListaMovimentos.js
const path = require("path");
const fs = require("fs");

// 🔑 Carrega variáveis do .env (OMIE_APP_KEY, OMIE_APP_SECRET, etc.)
require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
});

const { callOmie } = require("../services/omieClient");

// Endpoint e método do EXTRATO FINANCEIRO (listaMovimentos)
const OMIE_EXTRATO_ENDPOINT = "financas/extrato/";
const OMIE_EXTRATO_METHOD = "ListarExtrato";

// Conta corrente que vamos usar (vem do .env)
const NCODCC = Number(process.env.OMIE_NCODCC || 0);

// Datas no padrão dd/MM/aaaa
function formatDateBR(date) {
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const y = date.getFullYear().toString();
  return `${d}/${m}/${y}`;
}

// Campos da tabela listaMovimentos (na ordem da documentação)
const FIELDS = [
  "nCodLancamento",
  "nCodLancRelac",
  "cSituacao",
  "dDataLancamento",
  "cDesCliente",
  "cTipoDocumento",
  "cNumero",
  "nValorDocumento",
  "nSaldo",
  "cCodCategoria",
  "cDesCategoria",
  "cDocumentoFiscal",
  "cParcela",
  "cNossoNumero",
  "cOrigem",
  "cVendedor",
  "cProjeto",
  "nCodCliente",
  "cRazCliente",
  "cDocCliente",
  "cObservacoes",
  "cDataInclusao",
  "cHoraInclusao",
  "cNatureza",
  "cBloqueado",
  "dDataConciliacao",
];

/**
 * Gera um CSV com TODAS as colunas da listaMovimentos, conforme a documentação.
 */
function dumpListaMovimentosToCsv(movimentos, dInicial, dFinal) {
  try {
    if (!movimentos || movimentos.length === 0) {
      console.log(
        `📂 Nenhum movimento em listaMovimentos para o período ${dInicial} a ${dFinal}.`
      );
      return;
    }

    const lines = [];

    // Cabeçalho (linha 1)
    lines.push(FIELDS.join(";"));

    // Linhas de dados
    for (const mov of movimentos) {
      const row = FIELDS.map((field) => {
        let val = mov[field];

        if (val === null || val === undefined) return "";

        if (typeof val === "object") {
          // se por algum motivo vier algo complexo, transforma em JSON
          return JSON.stringify(val).replace(/;/g, ",");
        }

        return String(val).replace(/;/g, ",");
      }).join(";");

      lines.push(row);
    }

    const dir = path.join(__dirname, "..", "data");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filePath = path.join(
      dir,
      "extrato_listaMovimentos_completo.csv"
    );
    fs.writeFileSync(filePath, lines.join("\n"), "utf8");

    console.log(
      `📂 CSV listaMovimentos gerado com ${movimentos.length} linhas em: ${filePath}`
    );
  } catch (err) {
    console.error(
      "💥 Erro ao gerar CSV da listaMovimentos:",
      err.message || err
    );
  }
}

async function main() {
  try {
    if (!NCODCC || Number.isNaN(NCODCC)) {
      console.error(
        "💥 OMIE_NCODCC não está definido ou não é numérico no .env. " +
          "Edite Backend/.env e adicione, por exemplo: OMIE_NCODCC=10788819125"
      );
      return;
    }

    const hoje = new Date();
    const dInicial = "01/01/2023";
    const dFinal = formatDateBR(hoje);

    console.log("🔎 Chamando Omie Extrato Financeiro (ListarExtrato)...");
    console.log(`🏦 nCodCC = ${NCODCC}`);
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
    // 🔍 Salva resposta bruta do Omie pra conferência
const debugDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(debugDir)) {
  fs.mkdirSync(debugDir, { recursive: true });
}
const rawPath = path.join(
  debugDir,
  `raw_extrato_${NCODCC}.json`
);
fs.writeFileSync(rawPath, JSON.stringify(response, null, 2), "utf8");
console.log(`📂 Resposta bruta do extrato salva em: ${rawPath}`);


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
      `📊 Total de lançamentos em listaMovimentos: ${movimentos.length}`
    );

    if (movimentos.length > 0) {
      console.log("🔎 Exemplo do primeiro item de listaMovimentos:");
      console.log(movimentos[0]);
    }

    dumpListaMovimentosToCsv(movimentos, dInicial, dFinal);
  } catch (err) {
    console.error(
      "💥 Erro ao chamar Extrato Financeiro (ListarExtrato):",
      err?.response?.data || err.message || err
    );
  }
}

main();
