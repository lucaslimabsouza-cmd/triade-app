// Backend/services/notificationsExcelService.js
const xlsx = require("xlsx");
const axios = require("axios");

const { getInvestorAmountForProject } = require("./omieCostsService");

const NOTIFICATIONS_SHEET_URL =
  process.env.NOTIFICATIONS_SHEET_URL || process.env.LOGIN_SHEET_URL;

/**
 * Normaliza texto/chaves:
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
 * 🔑 Carrega workbook EXCLUSIVAMENTE via URL (Drive)
 */
async function loadWorkbook() {
  if (!NOTIFICATIONS_SHEET_URL) {
    throw new Error(
      "NOTIFICATIONS_SHEET_URL não definida. Configure a URL da planilha no .env / Render."
    );
  }

  console.log("🌐 [NOTIF] Baixando planilha do Drive:", NOTIFICATIONS_SHEET_URL);

  const response = await axios.get(NOTIFICATIONS_SHEET_URL, {
    responseType: "arraybuffer",
  });

  const buffer = Buffer.from(response.data);
  const workbook = xlsx.read(buffer, { type: "buffer" });

  console.log("✅ [NOTIF] Planilha carregada via Drive.");
  return workbook;
}

/**
 * Encontra aba de notificações por aproximação
 */
function findNotificationsSheet(workbook) {
  const sheetNames = workbook.SheetNames || [];
  console.log("📑 [NOTIF] Abas encontradas:", sheetNames);

  for (const sheetName of sheetNames) {
    const norm = normalizeKey(sheetName);
    if (norm.includes("ultimasnotificacoes") || norm.includes("notificacoes")) {
      console.log(`✅ [NOTIF] Aba de notificações: "${sheetName}"`);
      return workbook.Sheets[sheetName];
    }
  }

  throw new Error(
    'Aba "Últimas Notificações" / "Notificações" não encontrada na planilha.'
  );
}

/**
 * Lê aba de notificações e transforma em lista de objetos
 */
function parseNotificationsSheet(sheet) {
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: null });

  const notifications = rows
    .map((row, index) => {
      const normalizedMap = {};
      Object.keys(row).forEach((rawKey) => {
        normalizedMap[normalizeKey(rawKey)] = row[rawKey];
      });

      const idRaw = normalizedMap["id"] || normalizedMap["codigo"] || index + 2;
      const dataHoraRaw =
        normalizedMap["datahora"] || normalizedMap["data"] || null;

      const codigoImovelRaw =
        normalizedMap["codigoimovel"] ||
        normalizedMap["imovel"] ||
        normalizedMap["imoveltriade"] ||
        normalizedMap["operacao"] ||
        normalizedMap["projeto"] ||
        null;

      const tituloRaw =
        normalizedMap["titulo"] ||
        normalizedMap["assunto"] ||
        "Notificação";

      const msgCurtaRaw =
        normalizedMap["mensagemcurta"] ||
        normalizedMap["mensagem"] ||
        "";

      const msgDetalhadaRaw =
        normalizedMap["mensagemdetalhada"] ||
        normalizedMap["detalhes"] ||
        null;

      const tipoRaw = normalizedMap["tipo"] || null;
      const enviarPushRaw =
        normalizedMap["enviarpush"] || normalizedMap["push"] || null;

      if (!codigoImovelRaw || !msgCurtaRaw) return null;

      return {
        id: String(idRaw),
        dateTimeRaw: dataHoraRaw ? String(dataHoraRaw) : null,
        codigoImovel: String(codigoImovelRaw).trim(),
        title: String(tituloRaw).trim(),
        shortMessage: String(msgCurtaRaw).trim(),
        detailedMessage: msgDetalhadaRaw
          ? String(msgDetalhadaRaw).trim()
          : null,
        type: tipoRaw ? String(tipoRaw).trim() : null,
        enviarPush: enviarPushRaw
          ? String(enviarPushRaw).trim().toUpperCase()
          : null,
      };
    })
    .filter(Boolean);

  console.log(`✅ [NOTIF] Notificações processadas: ${notifications.length}`);
  return notifications;
}

/**
 * Retorna notificações relevantes para um CPF específico
 */
async function getNotificationsForCpf(cpfInput) {
  const cpf = String(cpfInput || "").replace(/[^\d]/g, "");
  if (!cpf) return [];

  const workbook = await loadWorkbook();
  const sheetNotif = findNotificationsSheet(workbook);
  const notifications = parseNotificationsSheet(sheetNotif);

  const result = [];

  for (const notif of notifications) {
    const propertyName = String(notif.codigoImovel || "").trim();
    if (!propertyName) continue;

    const invested = await getInvestorAmountForProject(cpf, propertyName);

    if (Number(invested || 0) > 0) {
      result.push(notif);
    }
  }

  result.sort((a, b) => {
    const aTime = Date.parse(a.dateTimeRaw || "") || 0;
    const bTime = Date.parse(b.dateTimeRaw || "") || 0;
    return bTime - aTime;
  });

  console.log(
    `📌 [NOTIF] CPF=${cpf} -> ${result.length} notificações liberadas.`
  );

  return result;
}

module.exports = {
  getNotificationsForCpf,
};
