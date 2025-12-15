// Backend/server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const omieRoutes = require("./routes/omie");
const authRoutes = require("./routes/auth");
const operationsRoutes = require("./routes/operations");
const debugOmieRoutes = require("./routes/debug-omie");
const notificationsRoutes = require("./routes/notifications");
const { setLastLoginCpf } = require("./sessionStore");

const app = express();

/* =========================
   MIDDLEWARES
========================= */
app.use(cors());
app.use(bodyParser.json());

/* =========================
   ROTAS PRINCIPAIS
========================= */
app.use("/omie", omieRoutes);
app.use("/auth", authRoutes);
app.use("/operations", operationsRoutes);
app.use("/debug-omie", debugOmieRoutes);
app.use("/notifications", notificationsRoutes);

/* =========================
   LOGIN LEGADO (TESTE)
========================= */
app.post("/login", (req, res) => {
  const { cpf, password } = req.body;

  // Guarda o CPF da última tentativa de login (mesmo se der 401)
  setLastLoginCpf(cpf);

  console.log("🔐 Requisição de login recebida (rota /login):", cpf);

  // login fake de teste
  if (cpf === "00000000000" && password === "123456") {
    return res.json({
      token: "fake-token-123",
      user: {
        id: "1",
        name: "Usuário Teste Triade",
        email: "teste@triade.com",
      },
    });
  }

  return res.status(401).json({
    message: "CPF ou senha inválidos.",
  });
});

/* =========================
   HEALTH CHECK (RENDER)
========================= */
app.get("/health", (req, res) => {
  return res.status(200).send("ok");
});

/* =========================
   ROOT
========================= */
app.get("/", (req, res) => {
  return res.json({ message: "Backend Triade rodando 🚀" });
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 4000;

// IMPORTANTE: 0.0.0.0 é necessário no Render
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Backend Triade rodando na porta ${PORT}`);
});
