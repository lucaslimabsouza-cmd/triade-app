// Backend/scripts/debugOmieMF.js
const path = require("path");
const fs = require("fs");

// 🔑 Carrega variáveis do .env
require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
});

const { callOmieFinancasMF } = require("../services/omieClient");

// Método do Movimento Financeiro
const OMIE_MF_METHOD = "ListarMovimentos";

/**
 * Gera um CSV com campos achatados (detalhes + resumo)
 */
function dumpMfToCsv(movimentos) {
  try {
    if (!movimentos || movimentos.length === 0) {
      console.log("📂 Nenhum movimento para gerar CSV de debug (MF).");
      return;
    }

    // Achata cada movimento em um objeto simples
    const flat = movimentos.map((mov) => {
      const det = mov.detalhes || {};
      const res = mov.resumo || {};

      const natureza = (det.cNatureza || "").toUpperCase();
      const tipoMov =
        natureza === "R"
          ? "ENTRADA"
          : natureza === "P"
          ? "SAIDA"
          : natureza || "";

      return {
        nCodCC: det.nCodCC || "",
        cCodProjeto: det.cCodProjeto || "",
        cGrupo: det.cGrupo || "",
        cNatureza: det.cNatureza || "",
        tipoMov,
        cStatus: det.cStatus || "",
        dDtEmissao: det.dDtEmissao || "",
        dDtVenc: det.dDtVenc || "",
        dDtPagamento: det.dDtPagamento || "",
        dDtRegistro: det.dDtRegistro || "",
        cCodCateg: det.cCodCateg || "",
        nCodTitulo: det.nCodTitulo || "",
        nValorTitulo: det.nValorTitulo || 0,
        nValPago: res.nValPago || 0,
        nValLiquido: res.nValLiquido || 0,
        nValAberto: res.nValAberto || 0,
        nDesconto: res.nDesconto || 0,
        nJuros: res.nJuros || 0,
        nMulta: res.nMulta || 0,
        cCPFCNPJCliente: det.cCPFCNPJCliente || "",
        nCodCliente: det.nCodCliente || "",
      };
    });

    const headers = Object.keys(flat[0]);

    const lines = [];
    lines.push(headers.join(";"));

    for (const row of flat) {
      lines.push(
        headers
          .map((h) => {
            let val = row[h];

            if (val === null || val === undefined) return "";

            if (typeof val === "object") {
              return JSON.stringify(val).replace(/;/g, ",");
            }

            return String(val).replace(/;/g, ",");
          })
          .join(";")
      );
    }

    const dir = path.join(__dirname, "..", "data");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filePath = path.join(
      dir,
      "debug_omie_movimentos_financeiros_mf.csv"
    );
    fs.writeFileSync(filePath, lines.join("\n"), "utf8");

    console.log(
      `📂 CSV de debug (MF) gerado com ${flat.length} linhas em: ${filePath}`
    );
  } catch (err) {
    console.error(
      "💥 Erro ao gerar CSV de debug dos Movimentos Financeiros (MF):",
      err.message || err
    );
  }
}

async function main() {
  try {
    console.log("🔎 Chamando Omie Movimentos Financeiros (ListarMovimentos)...");

    const params = {
      nPagina: 1,
      nRegPorPagina: 500,
      // depois podemos adicionar filtros (por conta, projeto, datas, etc.)
    };

    const response = await callOmieFinancasMF(OMIE_MF_METHOD, params);

    console.log(
      "🧾 Resposta bruta do Omie (top-level keys):",
      response ? Object.keys(response) : "sem resposta"
    );

    const movimentos =
      response?.movimentos ||
      response?.listaMovimentos ||
      response?.lista_movimentos ||
      response?.response?.movimentos ||
      [];

    console.log(`📊 Total de movimentos (MF) retornados: ${movimentos.length}`);

    if (movimentos.length > 0) {
      console.log("🔎 Exemplo de movimento bruto (primeiro item):");
      console.log(movimentos[0]);
    }

    dumpMfToCsv(movimentos);
  } catch (err) {
    console.error(
      "💥 Erro ao chamar Movimentos Financeiros (ListarMovimentos):",
      err?.response?.data || err.message || err
    );
  }
}

main();
