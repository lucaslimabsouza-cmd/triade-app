const express = require("express");
const router = express.Router();

const { getNotificationsForCpf } = require("../services/notificationsExcelService");
const { getLastLoginCpf } = require("../sessionStore");

/**
 * Extrai CPF do token no formato:
 *   excel-login-<cpf>
 * Ex: "excel-login-12398921603"
 */
function getCpfFromAuthHeader(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

  if (!token) return null;

  if (token.startsWith("excel-login-")) {
    const cpf = token.replace("excel-login-", "").replace(/[^\d]/g, "");
    return cpf || null;
  }

  return null;
}

/**
 * GET /notifications
 *
 * Ordem:
 *  1) ?cpf= (teste)
 *  2) token (RECOMENDADO)
 *  3) sessionStore (fallback)
 */
router.get("/", async (req, res) => {
  try {
    const cpfFromQuery = String(req.query.cpf || "").replace(/[^\d]/g, "");
    const cpfFromToken = getCpfFromAuthHeader(req);
    const cpfFromSession = getLastLoginCpf();

    const cpf = String(cpfFromQuery || cpfFromToken || cpfFromSession || "").replace(
      /[^\d]/g,
      ""
    );

    console.log("🔔 [NOTIF ROUTE] GET /notifications para CPF:", cpf || "(vazio)");

    if (!cpf) {
      return res.status(400).json({
        success: false,
        message:
          "CPF não encontrado. Faça login primeiro (token) ou informe ?cpf= na URL para teste.",
      });
    }

    const list = await getNotificationsForCpf(cpf);

    console.log(`🔔 [NOTIF ROUTE] Retornando ${list.length} notificações para CPF=${cpf}.`);
    return res.json(list);
  } catch (err) {
    console.error("💥 [NOTIF ROUTE] Erro em GET /notifications:", err.message || err);
    return res.status(500).json({
      success: false,
      message: "Erro ao buscar notificações.",
    });
  }
});

module.exports = router;
