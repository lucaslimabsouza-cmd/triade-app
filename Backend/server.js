// Backend/server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const axios = require("axios"); // para chamar as APIs do Omie

const omieRoutes = require("./routes/omie");
const authRoutes = require("./routes/auth");
const operationsRoutes = require("./routes/operations"); // rota de operações
const debugOmieRoutes = require("./routes/debug-omie");
const notificationsRoutes = require("./routes/notifications"); // 🔔 NOVO
const { setLastLoginCpf } = require("./sessionStore");

const app = express();

app.use(cors());
app.use(bodyParser.json());

// Rotas principais
app.use("/omie", omieRoutes);
app.use("/auth", authRoutes);
app.use("/operations", operationsRoutes);
app.use("/debug-omie", debugOmieRoutes);
app.use("/notifications", notificationsRoutes); // 🔔 NOVO

/**
 * 🔐 Rota de LOGIN "antiga" usada em modo teste
 * Hoje o app está usando /auth/login (authRoutes),
 * mas vou manter essa aqui pra não quebrar nada que você já tenha usado.
 */
app.post("/login", (req, res) => {
  const { cpf, password } = req.body;

  // Guarda o CPF da última tentativa de login (mesmo se der 401)
  setLastLoginCpf(cpf);

  console.log("🔐 Requisição de login recebida (rota /login):", cpf, password);

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

// Rota simples pra testar se o backend está vivo
app.get("/", (req, res) => {
  res.json({ message: "Backend Triade rodando 🚀" });
});

/**
 * 🔧 Função auxiliar para "achatar" (flatten) objetos aninhados
 * Ex.: { detalhes: { cCodCateg: "123" } } -> { "detalhes_cCodCateg": "123" }
 */
function flattenObject(obj, prefix = "", result = {}) {
  if (!obj || typeof obj !== "object") return result;

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}_${key}` : key;

    if (value && typeof value === "object" && !Array.isArray(value)) {
      // Objeto aninhado: chama recursivo
      flattenObject(value, newKey, result);
    } else {
      // Valor simples ou array: guarda como string
      result[newKey] =
        value === null || value === undefined
          ? ""
          : Array.isArray(value)
          ? JSON.stringify(value)
          : value;
    }
  }

  return result;
}

/**
 * 🔎 1) Movimentos da conta (cTpLancamento = "CC") -> movimentos_omie_completos.csv
 * GET http://SEU_IP:4000/teste-movimentos
 */
app.get("/teste-movimentos", async (req, res) => {
  try {
    const payload = {
      call: "ListarMovimentos",
      app_key: process.env.OMIE_APP_KEY,
      app_secret: process.env.OMIE_APP_SECRET,
      param: [
        {
          nPagina: 1,
          nRegPorPagina: 500,
          cTpLancamento: "CC", // lançamentos de conta corrente (extrato)
          // cCodCta: "CODIGO_DA_CONTA_AQUI",
          // dDtIni: "2025-01-01",
          // dDtFin: "2025-12-31",
        },
      ],
    };

    const { data } = await axios.post(
      "https://app.omie.com.br/api/v1/financas/mf/",
      payload
    );

    console.log(
      "🔍 Chaves do objeto principal retornado pelo Omie (movimentos):"
    );
    console.log(Object.keys(data || {}));

    let movimentos =
      data?.movimentos ||
      data?.listaMovimentos ||
      data?.lista_movimentos ||
      data?.response?.movimentos ||
      null;

    // Tentativa automática se não achar pelos nomes comuns
    if (!Array.isArray(movimentos)) {
      for (const key of Object.keys(data || {})) {
        if (
          Array.isArray(data[key]) &&
          data[key].length &&
          typeof data[key][0] === "object"
        ) {
          movimentos = data[key];
          console.log(
            `ℹ️ Usando lista encontrada em data["${key}"] como movimentos.`
          );
          break;
        }
      }
    }

    if (!Array.isArray(movimentos) || movimentos.length === 0) {
      return res
        .status(200)
        .send("Nenhum movimento encontrado com esses filtros.");
    }

    const linhasObjetos = movimentos.map((mov, idx) => {
      const flat = flattenObject(mov, "", {});
      if (!flat.__index) flat.__index = idx + 1;
      return flat;
    });

    const headerSet = new Set();
    for (const obj of linhasObjetos) {
      Object.keys(obj).forEach((k) => headerSet.add(k));
    }
    const headers = Array.from(headerSet);

    const linhas = [];
    linhas.push(headers.join(";")); // cabeçalho

    for (const item of linhasObjetos) {
      const linha = headers
        .map((campo) => {
          let valor = item[campo];
          if (valor === null || valor === undefined) valor = "";
          valor = String(valor).replace(/"/g, '""');
          return `"${valor}"`;
        })
        .join(";");
      linhas.push(linha);
    }

    const csv = linhas.join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=movimentos_omie_completos.csv"
    );

    return res.send(csv);
  } catch (error) {
    console.error(
      "❌ Erro ao buscar movimentos no Omie:",
      error?.response?.data || error.message
    );
    return res
      .status(500)
      .send(
        "Erro ao buscar movimentos no Omie. Veja o console do backend para mais detalhes."
      );
  }
});

/**
 * 🔎 2) Biblioteca de CLIENTES/FORNECEDORES -> clientes_fornecedores_omie.csv
 * Usa a API: https://app.omie.com.br/api/v1/geral/clientes/ (ListarClientes)
 * GET http://SEU_IP:4000/teste-clientes
 */
app.get("/teste-clientes", async (req, res) => {
  try {
    const url = "https://app.omie.com.br/api/v1/geral/clientes/";
    let pagina = 1;
    const todos = [];

    while (true) {
      const payload = {
        call: "ListarClientes",
        app_key: process.env.OMIE_APP_KEY,
        app_secret: process.env.OMIE_APP_SECRET,
        param: [
          {
            pagina,
            registros_por_pagina: 200,
            apenas_importado_api: "N",
          },
        ],
      };

      const { data } = await axios.post(url, payload);

      console.log(`📄 Página de clientes: ${pagina}`);
      console.log(
        "Chaves do objeto principal (clientes):",
        Object.keys(data || {})
      );

      let lista =
        data?.clientes_cadastro ||
        data?.clientes ||
        data?.cadastro ||
        data?.response?.clientes_cadastro ||
        [];

      if (!Array.isArray(lista) || lista.length === 0) {
        break;
      }

      todos.push(...lista);

      const totalPaginas =
        data?.total_de_paginas ||
        data?.total_paginas ||
        data?.totalDePaginas ||
        pagina;

      if (!totalPaginas || pagina >= totalPaginas) break;
      pagina++;
    }

    if (!todos.length) {
      return res
        .status(200)
        .send("Nenhum cliente/fornecedor encontrado na API do Omie.");
    }

    const linhasObjetos = todos.map((cli, idx) => {
      const flat = flattenObject(cli, "", {});
      if (!flat.__index) flat.__index = idx + 1;
      return flat;
    });

    const headerSet = new Set();
    for (const obj of linhasObjetos) {
      Object.keys(obj).forEach((k) => headerSet.add(k));
    }
    const headers = Array.from(headerSet);

    const linhas = [];
    linhas.push(headers.join(";")); // cabeçalho

    for (const item of linhasObjetos) {
      const linha = headers
        .map((campo) => {
          let valor = item[campo];
          if (valor === null || valor === undefined) valor = "";
          valor = String(valor).replace(/"/g, '""');
          return `"${valor}"`;
        })
        .join(";");
      linhas.push(linha);
    }

    const csv = linhas.join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=clientes_fornecedores_omie.csv"
    );

    return res.send(csv);
  } catch (error) {
    console.error(
      "❌ Erro ao buscar clientes/fornecedores no Omie:",
      error?.response?.data || error.message
    );
    return res
      .status(500)
      .send(
        "Erro ao buscar clientes/fornecedores no Omie. Veja o console do backend para mais detalhes."
      );
  }
});

/**
 * 🔎 3) Biblioteca de PROJETOS -> projetos_omie.csv
 * Usa a API: https://app.omie.com.br/api/v1/geral/projetos/ (ListarProjetos)
 * GET http://SEU_IP:4000/teste-projetos
 */
app.get("/teste-projetos", async (req, res) => {
  try {
    const url = "https://app.omie.com.br/api/v1/geral/projetos/";
    let pagina = 1;
    const todos = [];

    while (true) {
      const payload = {
        call: "ListarProjetos",
        app_key: process.env.OMIE_APP_KEY,
        app_secret: process.env.OMIE_APP_SECRET,
        param: [
          {
            pagina,
            registros_por_pagina: 200,
            apenas_importado_api: "N",
            // podemos filtrar por nome_projeto depois, se precisar
          },
        ],
      };

      const { data } = await axios.post(url, payload);

      console.log(`📄 Página de projetos: ${pagina}`);
      console.log(
        "Chaves do objeto principal (projetos):",
        Object.keys(data || {})
      );

      // projListarResponse normalmente traz "cadastro" como array de projetos
      let lista =
        data?.cadastro ||
        data?.projetos ||
        data?.response?.cadastro ||
        [];

      if (!Array.isArray(lista) || lista.length === 0) {
        break;
      }

      todos.push(...lista);

      const totalPaginas =
        data?.total_de_paginas ||
        data?.total_paginas ||
        data?.totalDePaginas ||
        pagina;

      if (!totalPaginas || pagina >= totalPaginas) break;
      pagina++;
    }

    if (!todos.length) {
      return res
        .status(200)
        .send("Nenhum projeto encontrado na API do Omie.");
    }

    const linhasObjetos = todos.map((proj, idx) => {
      const flat = flattenObject(proj, "", {});
      if (!flat.__index) flat.__index = idx + 1;
      return flat;
    });

    const headerSet = new Set();
    for (const obj of linhasObjetos) {
      Object.keys(obj).forEach((k) => headerSet.add(k));
    }
    const headers = Array.from(headerSet);

    const linhas = [];
    linhas.push(headers.join(";")); // cabeçalho

    for (const item of linhasObjetos) {
      const linha = headers
        .map((campo) => {
          let valor = item[campo];
          if (valor === null || valor === undefined) valor = "";
          valor = String(valor).replace(/"/g, '""');
          return `"${valor}"`;
        })
        .join(";");
      linhas.push(linha);
    }

    const csv = linhas.join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=projetos_omie.csv"
    );

    return res.send(csv);
  } catch (error) {
    console.error(
      "❌ Erro ao buscar projetos no Omie:",
      error?.response?.data || error.message
    );
    return res
      .status(500)
      .send(
        "Erro ao buscar projetos no Omie. Veja o console do backend para mais detalhes."
      );
  }
});

/**
 * 🧰 Helpers para debug de lucro distribuído
 */
function normalizarTexto(str = "") {
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function listarProjetosDebug() {
  const url = "https://app.omie.com.br/api/v1/geral/projetos/";
  let pagina = 1;
  const todos = [];

  while (true) {
    const payload = {
      call: "ListarProjetos",
      app_key: process.env.OMIE_APP_KEY,
      app_secret: process.env.OMIE_APP_SECRET,
      param: [
        {
          pagina,
          registros_por_pagina: 200,
          apenas_importado_api: "N",
        },
      ],
    };

    const { data } = await axios.post(url, payload);

    let lista =
      data?.cadastro ||
      data?.projetos ||
      data?.response?.cadastro ||
      [];

    if (!Array.isArray(lista) || lista.length === 0) {
      break;
    }

    todos.push(...lista);

    const totalPaginas =
      data?.total_de_paginas ||
      data?.total_paginas ||
      data?.totalDePaginas ||
      pagina;

    if (!totalPaginas || pagina >= totalPaginas) break;
    pagina++;
  }

  console.log(`📂 [DEBUG] Projetos Omie carregados: ${todos.length}`);
  return todos;
}

async function listarMovimentosDebug() {
  const url = "https://app.omie.com.br/api/v1/financas/mf/";
  let pagina = 1;
  const todos = [];

  while (true) {
    const payload = {
      call: "ListarMovimentos",
      app_key: process.env.OMIE_APP_KEY,
      app_secret: process.env.OMIE_APP_SECRET,
      param: [
        {
          nPagina: pagina,
          nRegPorPagina: 500,
          cTpLancamento: "CC",
        },
      ],
    };

    const { data } = await axios.post(url, payload);

    let lista =
      data?.movimentos ||
      data?.listaMovimentos ||
      data?.lista_movimentos ||
      data?.response?.movimentos ||
      [];

    if (!Array.isArray(lista) || lista.length === 0) {
      break;
    }

    todos.push(...lista);

    const totalPaginas =
      data?.nTotPaginas ||
      data?.total_de_paginas ||
      data?.total_paginas ||
      data?.totalDePaginas ||
      pagina;

    if (!totalPaginas || pagina >= totalPaginas) break;
    pagina++;
  }

  console.log(`📂 [DEBUG] Movimentos Omie carregados: ${todos.length}`);
  return todos;
}

/**
 * 🔎 DEBUG: Lucro distribuído (Distribuição de Lucros) por projeto
 *
 * GET http://SEU_IP:4000/debug-lucro-projeto?propertyName=SCP0103%20Casa%203%20Cora%C3%A7%C3%B5es
 * Opcional:
 *   &codCategLucro=CODIGO_DA_CATEGORIA
 *   &natureza=P   (ou R) para forçar filtro de natureza
 */
app.get("/debug-lucro-projeto", async (req, res) => {
  try {
    const { propertyName, codCategLucro, natureza } = req.query;

    if (!propertyName) {
      return res
        .status(400)
        .json({ error: "Informe ?propertyName=nome_do_projeto" });
    }

    console.log(
      `🔎 [DEBUG] Calculando Distribuição de Lucros para propertyName="${propertyName}", codCategLucro="${codCategLucro || "-"}", natureza="${natureza || "-"}"`
    );

    const projetos = await listarProjetosDebug();
    const alvoNorm = normalizarTexto(propertyName);

    const projeto = projetos.find((p) => {
      const nomeNorm = normalizarTexto(p.nome || "");
      return nomeNorm === alvoNorm;
    });

    if (!projeto) {
      return res.status(404).json({
        error: "Projeto Omie não encontrado para esse propertyName.",
        propertyName,
      });
    }

    const codigoProjetoOmie = projeto.codigo;
    const movimentos = await listarMovimentosDebug();

    const naturezaFiltro = natureza
      ? String(natureza).toUpperCase()
      : "P"; // padrão: P (saída), mas pode ser mudado via query

    let totalLucro = 0;
    const distribuicoes = [];

    for (const mov of movimentos) {
      const detalhes = mov.detalhes || {};
      const resumo = mov.resumo || {};

      const codProjetoMov = detalhes.cCodProjeto;
      if (String(codProjetoMov) !== String(codigoProjetoOmie)) {
        continue;
      }

      const naturezaMov = String(detalhes.cNatureza || "").toUpperCase();

      // Se veio filtro de natureza (P/R), aplica
      if (naturezaFiltro && naturezaMov !== naturezaFiltro) {
        continue;
      }

      const categoriaCodigo = detalhes.cCodCateg || "SEM_CATEGORIA";
      const categoriaDescricaoBase =
        detalhes.cDescCateg ||
        detalhes.cCategoria ||
        String(categoriaCodigo);

      const descNorm = normalizarTexto(categoriaDescricaoBase);

      let ehDistribuicao = false;

      // 1) Se o usuário informou um código de categoria, usamos ele como critério principal
      if (codCategLucro) {
        if (String(categoriaCodigo) === String(codCategLucro)) {
          ehDistribuicao = true;
        }
      } else {
        // 2) Caso NÃO venha código, caímos no critério por descrição
        if (descNorm.includes("distribuicao de lucros")) {
          ehDistribuicao = true;
        }
      }

      if (!ehDistribuicao) continue;

      const valor = Number(resumo.nValPago || 0) || 0;
      if (!valor) continue;

      totalLucro += valor;

      distribuicoes.push({
        dataMovimento:
          resumo.dDtMov ||
          detalhes.dDtMov ||
          null,
        categoriaCodigo,
        categoriaDescricao: categoriaDescricaoBase,
        natureza: naturezaMov,
        valor,
        historico:
          detalhes.cHistorico ||
          resumo.cDescricao ||
          "",
      });
    }

    return res.json({
      propertyName,
      projetoOmie: {
        codigo: projeto.codigo,
        nome: projeto.nome,
      },
      totalMovimentosConsiderados: movimentos.length,
      totalLancamentosDistribuicao: distribuicoes.length,
      totalLucroDistribuido: totalLucro,
      distribuicoes,
      filtrosUsados: {
        codCategLucro: codCategLucro || null,
        natureza: naturezaFiltro || null,
      },
    });
  } catch (error) {
    console.error(
      "💥 Erro em /debug-lucro-projeto:",
      error?.response?.data || error.message
    );
    return res.status(500).json({
      error:
        "Erro ao calcular lucro distribuído. Veja o console do backend para mais detalhes.",
    });
  }
});

// 🔹 APENAS UMA declaração de PORT
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Backend rodando na porta ${PORT}`);
});
