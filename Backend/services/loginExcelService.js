// Backend/services/loginExcelService.js
const xlsx = require("xlsx");
const axios = require("axios");

// URL da planilha de login no Google Sheets (publicada)
// Você pode configurar em Backend/.env
// LOGIN_SHEET_URL=https://docs.google.com/spreadsheets/d/SEU_ID/export?format=xlsx
const LOGIN_SHEET_URL =
  process.env.LOGIN_SHEET_URL ||
  "https://docs.google.com/spreadsheets/d/15AOERlnlYcothASPtIRRTekknHiYzbt6/export?format=xlsx";

// Nome lógico desejado; vamos usar de forma "flexível"
const SHEET_LOGIN = "Login";

/**
 * Normaliza nomes de colunas e também nomes de abas:
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

/**
 * Baixa a planilha do Google Drive e cria o workbook do xlsx
 */
async function loadWorkbookFromDrive() {
  if (!LOGIN_SHEET_URL) {
    console.error(
      "💥 [LOGIN] LOGIN_SHEET_URL não configurada no .env. Configure a URL da planilha de login."
    );
    return null;
  }

  try {
    console.log("🌐 [LOGIN] Baixando planilha de login do Drive em:", LOGIN_SHEET_URL);

    const response = await axios.get(LOGIN_SHEET_URL, {
      responseType: "arraybuffer",
    });

    const buffer = Buffer.from(response.data);
    const workbook = xlsx.read(buffer, { type: "buffer" });

    console.log("✅ [LOGIN] Planilha de login carregada a partir do Drive.");
    return workbook;
  } catch (err) {
    console.error(
      "💥 [LOGIN] Erro ao baixar planilha de login do Drive:",
      err.message || err
    );
    return null;
  }
}

/**
 * Encontra a aba de login de forma flexível:
 * - tenta pelo nome exato
 * - se não achar, procura por uma aba cujo nome normalizado contenha "login"
 */
function findLoginSheet(workbook) {
  // 1) Tenta direto pelo nome configurado
  if (workbook.Sheets[SHEET_LOGIN]) {
    console.log(`✅ [LOGIN] Aba "${SHEET_LOGIN}" encontrada diretamente.`);
    return workbook.Sheets[SHEET_LOGIN];
  }

  // 2) Tenta de forma "inteligente"
  const desiredNorm = normalizeKey("login");
  const sheetNames = workbook.SheetNames || [];

  console.log("📑 [LOGIN] Abas encontradas na planilha:", sheetNames);

  for (const sheetName of sheetNames) {
    const norm = normalizeKey(sheetName);
    if (norm.includes(desiredNorm)) {
      console.log(
        `✅ [LOGIN] Aba de login encontrada por aproximação: "${sheetName}" (normalizado="${norm}")`
      );
      return workbook.Sheets[sheetName];
    }
  }

  console.error(
    `💥 [LOGIN] Nenhuma aba compatível com "login" foi encontrada na planilha.`
  );
  return null;
}

/**
 * Carrega todos os usuários da aba de login
 */
async function loadLoginSheet() {
  try {
    const workbook = await loadWorkbookFromDrive();
    if (!workbook) {
      return [];
    }

    // Usa o localizador "inteligente" de aba de login
    const sheet = findLoginSheet(workbook);
    if (!sheet) {
      return [];
    }

    const rows = xlsx.utils.sheet_to_json(sheet, { defval: null });

    const users = rows
      .map((row, index) => {
        const normalizedMap = {};
        Object.keys(row).forEach((rawKey) => {
          const normKey = normalizeKey(rawKey);
          normalizedMap[normKey] = row[rawKey];
        });

        // Tentativas de nomes de coluna
        const cpfRaw =
          normalizedMap["cpf"] ||
          normalizedMap["cpfinvestidor"] ||
          normalizedMap["documento"] ||
          null;

        const senhaRaw =
          normalizedMap["senha"] ||
          normalizedMap["password"] ||
          normalizedMap["senhalogin"] ||
          null;

        const nomeRaw =
          normalizedMap["nome"] ||
          normalizedMap["nomecompleto"] ||
          normalizedMap["investidor"] ||
          null;

        if (!cpfRaw || !senhaRaw) {
          console.log(
            `⚠️ [LOGIN] Linha ${index + 2} ignorada (sem CPF ou Senha)`,
            row
          );
          return null;
        }

        const cpfLimpo = String(cpfRaw).replace(/[^\d]/g, "");
        if (!cpfLimpo) {
          console.log(
            `⚠️ [LOGIN] Linha ${index + 2} com CPF inválido:`,
            row
          );
          return null;
        }

        return {
          cpf: cpfLimpo,
          senha: String(senhaRaw).trim(),
          nome: nomeRaw ? String(nomeRaw).trim() : "Investidor",
        };
      })
      .filter(Boolean);

    console.log(`✅ [LOGIN] Carregado ${users.length} registros de login.`);
    return users;
  } catch (err) {
    console.error(
      "💥 [LOGIN] Erro ao processar planilha de login:",
      err.message || err
    );
    return [];
  }
}

/**
 * Autentica usuário por CPF + senha
 * Retorna { cpf, nome } se ok, ou null se inválido
 */
async function authenticateLogin(cpfInput, senhaInput) {
  const cpfLimpo = String(cpfInput || "").replace(/[^\d]/g, "");
  const senha = String(senhaInput || "").trim();

  if (!cpfLimpo || !senha) {
    return null;
  }

  const users = await loadLoginSheet();

  const found = users.find(
    (u) => u.cpf === cpfLimpo && u.senha === senha
  );

  if (!found) {
    console.log(
      `⚠️ [LOGIN] CPF ou senha inválidos para cpf=${cpfLimpo}`
    );
    return null;
  }

  console.log(
    `✅ [LOGIN] Autenticação bem-sucedida para cpf=${cpfLimpo} (nome=${found.nome})`
  );

  return {
    cpf: cpfLimpo,
    nome: found.nome,
  };
}

module.exports = {
  authenticateLogin,
};
