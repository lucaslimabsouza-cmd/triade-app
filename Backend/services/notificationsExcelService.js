const path = require("path");
const xlsx = require("xlsx");
const axios = require("axios");

const { getInvestorAmountForProject } = require("./omieCostsService");

const FILE_NAME = "Controle imóveis Triade.xlsx";
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
 * Tenta carregar workbook:
 * 1) via URL do Drive (se existir)
 * 2) se falhar, via arquivo local em Backend/data/FILE_NAME
 */
async function loadWorkbook() {
  // 1) Tenta via URL
  if (NOTIFICATIONS_SHEET_URL) {
    try {
      console.log("🌐 [NOTIF] Baixando planilha em:", NOTIFICATIONS_SHEET_URL);

      const response = await axios.get(NOTIFICATIONS_SHEET_URL, {
        responseType: "arraybuffer",
      });

      const buffer = Buffer.from(response.data);
      const workbook = xlsx.read(buffer, { type: "buffer" });

      console.log("✅ [NOTIF] Planilha carregada via URL.");
      return workbook;
    } catch (err) {
      console.error(
        "💥 [NOTIF] Erro ao baixar via URL, tentando local:",
        err.message || err
      );
    }
  } else {
    console.warn("⚠️ [NOTIF] Sem URL, tentando local.");
  }

  // 2) Fallback: arquivo local
  try {
    const filePath = path.join(__dirname, "..", "data", FILE_NAME);
    console.log("📄 [NOTIF] Lendo planilha local em:", filePath);

    const workbook = xlsx.readFile(filePath);
    console.log("✅ [NOTIF] Planilha local carregada.");
    return workbook;
  } catch (err) {
    console.error("💥 [NOTIF] Erro ao ler planilha local:", err.message || err);
    return null;
  }
}

/**
 * Encontra aba de notificações por aproximação
 */
function findNotificationsSheet(workbook) {
  const sheetNames = workbook.SheetNames || [];
  console.log("📑 [NOTIF] Abas:", sheetNames);

  for (const sheetName of sheetNames) {
    const norm = normalizeKey(sheetName);
    if (norm.includes("ultimasnotificacoes") || norm.includes("notificacoes")) {
      console.log(`✅ [NOTIF] Aba notificações: "${sheetName}"`);
      return workbook.Sheets[sheetName];
    }
  }

  console.error('💥 [NOTIF] Não achei aba "Ultimas Notificações"/"Notificações".');
  return null;
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

      if (!codigoImovelRaw || !msgCurtaRaw) {
        return null;
      }

      return {
        id: String(idRaw),
        dateTimeRaw: dataHoraRaw ? String(dataHoraRaw) : null,
        codigoImovel: String(codigoImovelRaw).trim(), // ex: "SCP0105 Ribeirão Preto"
        title: String(tituloRaw).trim(),
        shortMessage: String(msgCurtaRaw).trim(),
        detailedMessage: msgDetalhadaRaw ? String(msgDetalhadaRaw).trim() : null,
        type: tipoRaw ? String(tipoRaw).trim() : null,
        enviarPush: enviarPushRaw ? String(enviarPushRaw).trim().toUpperCase() : null,
      };
    })
    .filter(Boolean);

  console.log(`✅ [NOTIF] Notificações lidas: ${notifications.length}`);
  return notifications;
}

/**
 * Retorna notificações relevantes para um CPF específico.
 *
 * NOVA REGRA (robusta):
 * - Uma notificação pertence ao CPF se ele tiver aporte no Omie no projeto cujo nome = CodigoImovel
 */
async function getNotificationsForCpf(cpfInput) {
  const cpf = String(cpfInput || "").replace(/[^\d]/g, "");
  if (!cpf) {
    console.log("⚠️ [NOTIF] getNotificationsForCpf chamado sem CPF válido.");
    return [];
  }

  const workbook = await loadWorkbook();
  if (!workbook) return [];

  const sheetNotif = findNotificationsSheet(workbook);
  if (!sheetNotif) return [];

  const notifications = parseNotificationsSheet(sheetNotif);

  const result = [];

  for (const notif of notifications) {
    const propertyName = String(notif.codigoImovel || "").trim();
    if (!propertyName) continue;

    // ✅ decide se esse CPF "tem" esse imóvel via aporte no Omie
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

  console.log(`📌 [NOTIF] CPF=${cpf} -> ${result.length} notificações (via Omie).`);
  return result;
}

module.exports = {
  getNotificationsForCpf,
};
