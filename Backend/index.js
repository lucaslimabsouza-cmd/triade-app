// Backend/index.js
const express = require("express");
const cors = require("cors");

const app = express();

// middlewares básicos
app.use(cors());
app.use(express.json());

// 🔹 Usuários mockados (por enquanto)
const users = [
  {
    id: "inv_1",
    cpf: "12345678901", // só números
    password: "123456", // senha simples de exemplo
    name: "Investidor Triade",
    email: "investidor@triade.com",
  },
  // você pode adicionar mais usuários aqui depois
];

// 🔹 Função que monta o dashboard para um usuário (mock)
function buildDashboardForUser(userId) {
  // no futuro, aqui você busca no banco as operações desse userId
  return {
    totalInvested: 250000,
    totalActive: 180000,
    totalRealizedProfit: 52000,
    averageRoi: 32.5,
    investments: [
      {
        id: "1",
        propertyName: "Apartamento 302 - Vila Mariana",
        city: "São Paulo",
        state: "SP",
        status: "em_andamento",
        amountInvested: 80000,
        expectedReturn: 25000,
        roi: 31.25,
      },
      {
        id: "2",
        propertyName: "Casa - Jardim Europa",
        city: "Curitiba",
        state: "PR",
        status: "concluida",
        amountInvested: 60000,
        realizedProfit: 22000,
        roi: 36.6,
      },
    ],
    notifications: [
      {
        id: "n1",
        title: "Nova operação disponível",
        description:
          "Imóvel residencial em Campinas/SP com desconto de 32% abaixo do mercado.",
        date: "05/12/2025",
      },
    ],
  };
}

// -----------------------------------------------------------------------------
// POST /login  → autentica CPF + senha e devolve token + user
// -----------------------------------------------------------------------------
app.post("/login", (req, res) => {
  const { cpf, password } = req.body;

  if (!cpf || !password) {
    return res.status(400).json({
      error: "BAD_REQUEST",
      message: "CPF e senha são obrigatórios.",
    });
  }

  const cleanCpf = String(cpf).replace(/\D/g, "");

  const user = users.find(
    (u) => u.cpf === cleanCpf && u.password === String(password)
  );

  if (!user) {
    return res.status(401).json({
      error: "INVALID_CREDENTIALS",
      message: "CPF ou senha inválidos.",
    });
  }

  // 🔹 Aqui você poderia gerar um JWT de verdade.
  // Por enquanto, vamos gerar um token simples só pra fluxo funcionar.
  const token = `FAKE_TOKEN_${user.id}_${Date.now()}`;

  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  });
});

// -----------------------------------------------------------------------------
// GET /dashboard  → devolve dados do investidor logado
// -----------------------------------------------------------------------------
app.get("/dashboard", (req, res) => {
  const authHeader = req.headers["authorization"] || "";
  // Esperado: "Bearer TOKEN"
  const parts = authHeader.split(" ");
  const token = parts.length === 2 ? parts[1] : null;

  if (!token) {
    // se quiser já exigir token:
    // return res.status(401).json({ error: "UNAUTHORIZED", message: "Token ausente." });
    console.log("Sem token, mas retornando mock mesmo assim.");
  } else {
    console.log("Token recebido:", token);
  }

  // No futuro, você pode usar o token para descobrir qual userId está logado.
  // Por enquanto, vamos assumir que é sempre o primeiro usuário:
  const userId = "inv_1";

  const dashboard = buildDashboardForUser(userId);

  return res.json(dashboard);
});

// -----------------------------------------------------------------------------
// Sobe servidor
// -----------------------------------------------------------------------------
const PORT = 4000;
app.listen(PORT, () => {
  console.log(`API Triade rodando em http://localhost:${PORT}`);
});
