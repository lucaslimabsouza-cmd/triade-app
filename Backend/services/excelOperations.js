// Backend/services/excelOperations.js
const path = require("path");
const xlsx = require("xlsx");
const axios = require("axios");

const FILE_NAME = "Controle imóveis Triade 1.xlsx";
const SHEET_NAME = "Dados Imóveis";

// Opcional: se existir, tenta baixar a planilha por URL
const EXCEL_URL = process.env.EXCEL_URL;

/**
 * Normaliza nomes de colunas:
 * - minúsculas
 * - sem acentos
 * - sem espaços e pontuação
 */
function normalizeKey(key) {
  return String(key || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function parseNumberCell(value) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") return value;

  if (typeof value === "string") {
    const cleaned = value
      .replace(/\s+/g, "")
      .replace("%", "")
      .replace(/\./g, "")
      .replace(",", ".");

    const num = Number(cleaned);
    return isNaN(num) ? null : num;
  }

  return null;
}

function mapStatusCell(value) {
  if (!value) return "em_andamento";

  const str = String(value).toLowerCase().trim();

  if (str.startsWith("em")) return "em_andamento";
  if (str.startsWith("conc") || str.startsWith("final")) return "concluida";

  return "em_andamento";
}

/**
 * 🔑 Lê o workbook da planilha
 * Prioridade:
 * 1) URL pública (EXCEL_URL)
 * 2) Arquivo local em /Backend/data
 */
async function loadWorkbook() {
  if (EXCEL_URL) {
    try {
      console.log("🌐 Lendo planilha pela URL:", EXCEL_URL);

      const response = await axios.get(EXCEL_URL, {
        responseType: "arraybuffer",
      });

      return xlsx.read(response.data, { type: "buffer" });
    } catch (err) {
      console.error(
        "⚠️ Falha ao baixar planilha via URL. Usando arquivo local.",
        err.message || err
      );
    }
  }

  const filePath = path.resolve(
    process.cwd(),
    "Backend",
    "data",
    FILE_NAME
  );

  console.log("📄 Lendo planilha local em:", filePath);

  return xlsx.readFile(filePath);
}

/**
 * 📊 Lê a planilha e devolve um array de operações
 */
async function loadOperationsFromExcel() {
  try {
    const workbook = await loadWorkbook();

    let sheet = workbook.Sheets[SHEET_NAME];
    if (!sheet) {
      console.warn(
        `⚠️ Aba "${SHEET_NAME}" não encontrada. Usando primeira aba.`
      );
      sheet = workbook.Sheets[workbook.SheetNames[0]];
    }

    const rows = xlsx.utils.sheet_to_json(sheet, { defval: null });

    const operations = rows
      .map((row, index) => {
        const normalizedMap = {};
        Object.keys(row).forEach((rawKey) => {
          normalizedMap[normalizeKey(rawKey)] = row[rawKey];
        });

        const numero =
          normalizedMap["numeracao"] ||
          normalizedMap["numero"] ||
          null;

        const descricao =
          normalizedMap["descricaodoimovel"] ||
          normalizedMap["descricao"] ||
          null;

        if (!numero || !descricao) {
          console.log(
            `⚠️ Linha ${index + 2} ignorada (sem número ou descrição)`
          );
          return null;
        }

        const id = String(numero).trim();
        const propertyName = String(descricao).trim();

        const city = normalizedMap["cidade"]
          ? String(normalizedMap["cidade"]).trim()
          : "";

        const state = normalizedMap["estado"]
          ? String(normalizedMap["estado"]).trim()
          : "";

        const expectedReturn =
          parseNumberCell(normalizedMap["lucroesperado"]) ?? 0;

        const targetRoi =
          parseNumberCell(normalizedMap["roiesperado"]) ?? 0;

        const status = mapStatusCell(normalizedMap["status"]);

        const timeline = {
          dataArrematacao: normalizedMap["dataarrematacao"] || null,
          dataITBI: normalizedMap["dataitbi"] || null,
          dataEscritura:
            normalizedMap["dataescrituradecompraevenda"] || null,
          dataMatricula: normalizedMap["datamatricula"] || null,
          dataDesocupacao: normalizedMap["datadesocupacao"] || null,
          dataObra: normalizedMap["dataobra"] || null,
          dataDisponibilizadoImobiliaria:
            normalizedMap["datadisponibilizadoparaimobiliaria"] || null,
          dataContratoVenda:
            normalizedMap["datacontratodevenda"] || null,
          dataRecebimentoVenda:
            normalizedMap["datarecebimentodavenda"] || null,
        };

        const documents = {
          cartaArrematacao:
            normalizedMap["linkcartadearrematacao"] || null,
          matriculaConsolidada:
            normalizedMap["linkmatriculaconsolidada"] || null,
        };

        return {
          id,
          propertyName,
          city,
          state,
          expectedReturn,
          targetRoi,
          status,
          timeline,
          documents,
          estimatedTerm: normalizedMap["prazoestimado"]
            ? String(normalizedMap["prazoestimado"]).trim()
            : null,
          realizedTerm: normalizedMap["prazorealizado"]
            ? String(normalizedMap["prazorealizado"]).trim()
            : null,
        };
      })
      .filter(Boolean);

    console.log(`✅ Carregadas ${operations.length} operações da planilha`);
    return operations;
  } catch (err) {
    console.error(
      "💥 Erro ao ler planilha de operações:",
      err.message || err
    );
    return null;
  }
}

module.exports = {
  loadOperationsFromExcel,
};
