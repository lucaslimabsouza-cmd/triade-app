// Backend/routes/auth.js
const express = require("express");
const router = express.Router();

const { authenticateLogin } = require("../services/loginExcelService");
const { setLastLoginCpf } = require("../sessionStore");

/**
 * POST /auth/login
 * Body: { cpf: string, password: string }
 */
router.post("/login", async (req, res) => {
  const { cpf, password } = req.body || {};

  console.log("🔐 [AUTH] Requisição de login recebida:", cpf, password);

  if (!cpf || !password) {
    return res
      .status(400)
      .json({ success: false, message: "CPF e senha são obrigatórios." });
  }

  try {
    // Usa a planilha (aba de login no Drive) para autenticar
    const user = await authenticateLogin(cpf, password);

    if (!user) {
      // credenciais inválidas
      return res
        .status(401)
        .json({ success: false, message: "CPF ou senha inválidos." });
    }

    // guarda CPF na "sessão" (memória do backend) para filtrar operações depois
    setLastLoginCpf(user.cpf);

    // Gera um token simples só pra manter a estrutura do app
    const token = `excel-login-${user.cpf}`;

    // resposta padronizada pro app
    return res.json({
      success: true,
      mode: "real",
      token,
      user: {
        id: user.cpf, // usamos o próprio CPF como id
        cpf: user.cpf,
        name: user.nome,
        email: `${user.cpf}@triade-invest.local`,
      },
    });
  } catch (err) {
    console.error("💥 [AUTH] Erro inesperado no login:", err.message || err);
    return res
      .status(500)
      .json({ success: false, message: "Erro interno ao fazer login." });
  }
});

module.exports = router;
