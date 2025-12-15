// Backend/services/omieCostsService.js
require("dotenv").config();
const axios = require("axios");
const { getCache, setCache } = require("./cacheService");

/**
 * 🔐 Configuração básica da API Omie
 */
const OMIE_APP_KEY = process.env.OMIE_APP_KEY;
const OMIE_APP_SECRET = process.env.OMIE_APP_SECRET;

if (!OMIE_APP_KEY || !OMIE_APP_SECRET) {
  console.warn(
    "⚠️ OMIE_APP_KEY ou OMIE_APP_SECRET não configurados no .env. O serviço de custos Omie não vai funcionar corretamente."
  );
}

/**
 * TTL de cache (em segundos)
 */
const TTL_PROJETOS = 900;
const TTL_MOVIMENTOS = 900;
const TTL_CLIENTES = 900;
const TTL_CATEGORIAS = 900;
const TTL_CUSTOS_OPERACAO = 900;
const TTL_APORTE_PROJETO = 900;
const TTL_LUCRO_PROJETO = 900;

/**
 * Código fixo da categoria "Distribuição de Lucros" no Omie
 * (fornecido por você: 2.10.98)
 */
const COD_CATEGORIA_DISTRIB_LUCROS = "2.10.98";

/**
 * 🔧 Helper com retry para chamada genérica à API Omie
 */
async function callOmieApiWithRetry(url, payload, opts = {}) {
  const maxRetries = opts.maxRetries ?? 3;
  const timeoutMs = opts.timeoutMs ?? 15000; // 15s

  let attempt = 0;
  let delayMs = 1000; // 1s, depois 2s, 4s...

  while (attempt <= maxRetries) {
    try {
      if (attempt > 0) {
        console.log(
          `🔁 Tentativa ${attempt + 1} de chamar Omie (call="${payload?.call}")`
        );
      }

      const { data } = await axios.post(
        url,
        {
          ...payload,
          app_key: OMIE_APP_KEY,
          app_secret: OMIE_APP_SECRET,
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: timeoutMs,
        }
      );

      return data;
    } catch (error) {
      const status = error.response?.status;
      const data = error.response?.data;

      console.error("❌ ERRO NA CHAMADA OMIE:");
      console.error("URL:", url);
      console.error("CALL:", payload?.call);
      console.error("STATUS:", status);
      console.error("DATA:", data);
      console.error("MESSAGE:", error.message);

      // Erros permanentes: não adianta tentar de novo
      if ([400, 401, 403, 404].includes(status)) {
        console.error(
          "⛔ Erro considerado permanente (400/401/403/404). Não fará retry."
        );
        throw error;
      }

      attempt++;
      if (attempt > maxRetries) {
        console.error(
          `💣 Estourou número máximo de tentativas (${maxRetries + 1}) para call="${payload?.call}".`
        );
        throw error;
      }

      console.warn(
        `⚠️ Erro transitório ao chamar Omie (status=${status || "sem status"}). ` +
          `Aguardando ${delayMs / 1000}s para tentar novamente...`
      );

      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs *= 2;
    }
  }
}

/**
 * Wrapper simples que mantém assinatura antiga
 */
async function callOmieApi(url, payload) {
  return callOmieApiWithRetry(url, payload);
}

/**
 * 🔄 1) Listar TODOS os projetos do Omie
 */
async function listarProjetosOmie() {
  const cacheKey = "omie:projetos";

  const cacheHit = getCache(cacheKey);
  if (cacheHit) {
    console.log("📂 [CACHE] Projetos Omie carregados do cache.");
    return cacheHit;
  }

  const url = "https://app.omie.com.br/api/v1/geral/projetos/";
  let pagina = 1;
  const todos = [];

  while (true) {
    const payload = {
      call: "ListarProjetos",
      param: [
        {
          pagina,
          registros_por_pagina: 200,
          apenas_importado_api: "N",
        },
      ],
    };

    const data = await callOmieApi(url, payload);

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

  console.log(`📂 Projetos Omie carregados da API: ${todos.length}`);

  setCache(cacheKey, todos, TTL_PROJETOS);
  return todos;
}

/**
 * 🔄 2) Listar TODOS os movimentos de conta corrente (extrato)
 */
async function listarMovimentosOmieContaCorrente() {
  const cacheKey = "omie:movimentosCC";

  const cacheHit = getCache(cacheKey);
  if (cacheHit) {
    console.log("📂 [CACHE] Movimentos Omie (CC) carregados do cache.");
    return cacheHit;
  }

  const url = "https://app.omie.com.br/api/v1/financas/mf/";
  let pagina = 1;
  const todos = [];

  while (true) {
    const payload = {
      call: "ListarMovimentos",
      param: [
        {
          nPagina: pagina,
          nRegPorPagina: 500,
          cTpLancamento: "CC", // Conta Corrente (extrato)
        },
      ],
    };

    const data = await callOmieApi(url, payload);

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

  console.log(`📂 Movimentos Omie (CC) carregados da API: ${todos.length}`);

  setCache(cacheKey, todos, TTL_MOVIMENTOS);
  return todos;
}

/**
 * 🔄 3) Carrega todos os clientes/fornecedores e monta mapa por CPF/CNPJ
 */
async function carregarClientesPorCpfCnpj() {
  const cacheKey = "omie:clientesPorCpfCnpj";

  const cacheHit = getCache(cacheKey);
  if (cacheHit) {
    console.log(
      "📂 [CACHE] Clientes/fornecedores Omie carregados do cache."
    );
    return cacheHit;
  }

  const url = "https://app.omie.com.br/api/v1/geral/clientes/";
  let pagina = 1;
  const mapa = {};

  while (true) {
    const payload = {
      call: "ListarClientes",
      param: [
        {
          pagina,
          registros_por_pagina: 200,
          apenas_importado_api: "N",
        },
      ],
    };

    const data = await callOmieApi(url, payload);

    let lista =
      data?.clientes_cadastro ||
      data?.clientes ||
      data?.cadastro ||
      data?.response?.clientes_cadastro ||
      [];

    if (!Array.isArray(lista) || lista.length === 0) {
      break;
    }

    for (const cli of lista) {
      const cpfCnpj =
        cli.cnpj_cpf || cli.cnpj || cli.cpf || "";
      const nome =
        cli.nome_fantasia ||
        cli.razao_social ||
        "";

      if (cpfCnpj) {
        const chave = cpfCnpj.replace(/[^\d]/g, "");
        if (chave) {
          mapa[chave] = nome;
        }
      }
    }

    const totalPaginas =
      data?.total_de_paginas ||
      data?.total_paginas ||
      data?.totalDePaginas ||
      pagina;

    if (!totalPaginas || pagina >= totalPaginas) break;
    pagina++;
  }

  console.log(
    `📂 Clientes/fornecedores Omie carregados da API no mapa CPF/CNPJ: ${Object.keys(
      mapa
    ).length}`
  );

  setCache(cacheKey, mapa, TTL_CLIENTES);
  return mapa;
}

/**
 * 🔄 4) Carrega categorias financeiras (geral/categorias) e monta mapa por código
 */
async function carregarCategoriasFinanceiras() {
  const cacheKey = "omie:categoriasFinanceiras";

  const cacheHit = getCache(cacheKey);
  if (cacheHit) {
    console.log("📂 [CACHE] Categorias financeiras Omie carregadas do cache.");
    return cacheHit;
  }

  const url = "https://app.omie.com.br/api/v1/geral/categorias/";
  let pagina = 1;
  const mapa = {};

  try {
    while (true) {
      const payload = {
        call: "ListarCategorias",
        param: [
          {
            pagina,
            registros_por_pagina: 200,
          },
        ],
      };

      const data = await callOmieApi(url, payload);

      let lista =
        data?.categoria_cadastro ||
        data?.categorias ||
        data?.cadastro ||
        data?.response?.categoria_cadastro ||
        [];

      if (!Array.isArray(lista) || lista.length === 0) {
        break;
      }

      for (const cat of lista) {
        const codigo = cat.codigo;
        const descricao = cat.descricao;

        if (codigo) {
          const key = String(codigo);
          mapa[key] = {
            code: key,
            description: descricao || key,
          };
        }
      }

      const totalPaginas =
        data?.total_de_paginas ||
        data?.total_paginas ||
        data?.totalDePaginas ||
        pagina;

      if (!totalPaginas || pagina >= totalPaginas) break;
      pagina++;
    }

    console.log(
      `📂 Categorias financeiras Omie carregadas da API: ${Object.keys(
        mapa
      ).length}`
    );

    setCache(cacheKey, mapa, TTL_CATEGORIAS);
    return mapa;
  } catch (error) {
    console.error(
      "💥 Erro ao carregar categorias financeiras do Omie:",
      error?.response?.data || error.message
    );
    // Não derruba: segue sem biblioteca
    return {};
  }
}

/**
 * Normaliza texto (minúsculo, sem acento)
 */
function normalizarTexto(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * 🔍 5) Encontrar projeto Omie pelo nome
 */
function encontrarProjetoPorDescricao(projetos, propertyName) {
  const alvo = String(propertyName || "").trim().toLowerCase();

  const projeto = projetos.find((p) => {
    const nome = String(p.nome || "").trim().toLowerCase();
    return nome === alvo;
  });

  return projeto || null;
}

/**
 * 🧮 6) Custos da operação usando API Omie,
 *       excluindo:
 *       - "Devolução de capital ao investidor"
 *       - "Distribuição de Lucros" (por descrição OU por código 2.10.98)
 */
async function getOperationCostsFromOmie(operationId, propertyName) {
  const cacheKey = `omie:custosOperacao:${propertyName}`;

  const cacheHit = getCache(cacheKey);
  if (cacheHit) {
    console.log(
      `✅ [CACHE] Custos Omie reaproveitados para operação ${operationId} (propertyName="${propertyName}")`
    );
    return cacheHit;
  }

  try {
    console.log(
      `🔎 Calculando custos Omie para operação ${operationId} (propertyName="${propertyName}")`
    );

    // 1) Projetos
    const projetos = await listarProjetosOmie();
    const projeto = encontrarProjetoPorDescricao(projetos, propertyName);

    if (!projeto) {
      console.warn(
        `⚠️ Nenhum projeto Omie encontrado com nome = "${propertyName}" para operação ${operationId}.`
      );
      const result = {
        totalCosts: 0,
        categories: [],
        items: [],
      };

      setCache(cacheKey, result, TTL_CUSTOS_OPERACAO);
      return result;
    }

    const codigoProjetoOmie = projeto.codigo;
    console.log(
      `✅ Projeto Omie encontrado para "${propertyName}": codigo=${codigoProjetoOmie}, nome=${projeto.nome}`
    );

    // 2) Movimentos
    const movimentos = await listarMovimentosOmieContaCorrente();

    // 3) Clientes
    const mapaClientes = await carregarClientesPorCpfCnpj();

    // 4) Categorias financeiras
    const categoriasFinanceiras = await carregarCategoriasFinanceiras();

    let totalGeral = 0;
    const categoriasMap = {};
    const allItems = [];

    for (const mov of movimentos) {
      const detalhes = mov.detalhes || {};
      const resumo = mov.resumo || {};

      // Projeto
      const codProjetoMov = detalhes.cCodProjeto;
      if (String(codProjetoMov) !== String(codigoProjetoOmie)) {
        continue;
      }

      // Natureza: P = despesa (custo)
      const natureza = detalhes.cNatureza;
      if (natureza !== "P") {
        continue;
      }

      // Código da categoria
      const categoriaCodigo = detalhes.cCodCateg || "SEM_CATEGORIA";

      // Descrição da categoria
      const catInfo = categoriasFinanceiras[String(categoriaCodigo)] || null;
      const categoriaDescricao =
        catInfo?.description ||
        detalhes.cDescCateg ||
        detalhes.cCategoria ||
        String(categoriaCodigo);

      const descNorm = normalizarTexto(categoriaDescricao);

      const isDevolucaoCapital =
        descNorm.includes("devolucao de capital") &&
        descNorm.includes("investidor");

      const isDistribuicaoLucrosDesc =
        descNorm.includes("distribuicao de lucros");

      const isDistribuicaoLucrosCodigo =
        String(categoriaCodigo) === COD_CATEGORIA_DISTRIB_LUCROS;

      // 🔴 NÃO entra no custo:
      if (isDevolucaoCapital || isDistribuicaoLucrosDesc || isDistribuicaoLucrosCodigo) {
        continue;
      }

      // Valor
      const valor = Number(resumo.nValPago || 0) || 0;
      if (!valor) continue;

      // Cliente
      const cpfCnpjBruto = detalhes.cCPFCNPJCliente || "";
      const cpfCnpjLimpo = cpfCnpjBruto.replace(/[^\d]/g, "");
      const clienteNome =
        (cpfCnpjLimpo && mapaClientes[cpfCnpjLimpo]) ||
        cpfCnpjBruto ||
        "";

      totalGeral += valor;

      if (!categoriasMap[categoriaCodigo]) {
        categoriasMap[categoriaCodigo] = {
          categoryCode: categoriaCodigo,
          categoryDescription: categoriaDescricao,
          total: 0,
          items: [],
        };
      }

      const item = {
        value: valor,
        categoryCode: categoriaCodigo,
        categoryDescription: categoriaDescricao,
        cpfCnpjCliente: cpfCnpjBruto,
        clienteNome,
      };

      categoriasMap[categoriaCodigo].total += valor;
      categoriasMap[categoriaCodigo].items.push(item);
      allItems.push(item);
    }

    const categories = Object.values(categoriasMap).sort(
      (a, b) => b.total - a.total
    );

    console.log(
      `✅ Custos Omie calculados para operação ${operationId}: total=${totalGeral}, categorias=${categories.length}`
    );

    const result = {
      totalCosts: totalGeral,
      categories,
      items: allItems,
    };

    setCache(cacheKey, result, TTL_CUSTOS_OPERACAO);
    return result;
  } catch (error) {
    console.error(
      "💥 Erro em getOperationCostsFromOmie:",
      error?.response?.data || error.message
    );

    const result = {
      totalCosts: 0,
      categories: [],
      items: [],
    };

    setCache(cacheKey, result, TTL_CUSTOS_OPERACAO);
    return result;
  }
}

/**
 * 🧮 7) Quanto ESTE CPF/CNPJ investiu neste projeto?
 */
async function getInvestorAmountForProject(cpfCnpj, propertyName) {
  const cpfLimpo = String(cpfCnpj || "").replace(/[^\d]/g, "");

  if (!cpfLimpo) {
    return 0;
  }

  const cacheKey = `omie:aporte:${cpfLimpo}:${propertyName}`;

  const cacheHit = getCache(cacheKey);
  if (cacheHit !== null && cacheHit !== undefined) {
    console.log(
      `✅ [CACHE] Investimento Omie reaproveitado para CPF ${cpfLimpo} em "${propertyName}": total=${cacheHit}`
    );
    return cacheHit;
  }

  try {
    console.log(
      `🔎 Calculando aporte do CPF ${cpfLimpo} para o projeto "${propertyName}"`
    );

    const projetos = await listarProjetosOmie();
    const projeto = encontrarProjetoPorDescricao(projetos, propertyName);

    if (!projeto) {
      console.warn(
        `⚠️ Nenhum projeto Omie encontrado com nome = "${propertyName}" ao calcular aporte do CPF ${cpfLimpo}.`
      );
      setCache(cacheKey, 0, TTL_APORTE_PROJETO);
      return 0;
    }

    const codigoProjetoOmie = projeto.codigo;
    console.log(
      `✅ Projeto para aporte encontrado: codigo=${codigoProjetoOmie}, nome=${projeto.nome}`
    );

    const movimentos = await listarMovimentosOmieContaCorrente();

    let totalInvestido = 0;

    for (const mov of movimentos) {
      const detalhes = mov.detalhes || {};
      const resumo = mov.resumo || {};

      const codProjetoMov = detalhes.cCodProjeto;
      if (String(codProjetoMov) !== String(codigoProjetoOmie)) {
        continue;
      }

      const natureza = detalhes.cNatureza;
      if (natureza !== "R") {
        continue;
      }

      const cpfMov = String(detalhes.cCPFCNPJCliente || "").replace(
        /[^\d]/g,
        ""
      );
      if (!cpfMov || cpfMov !== cpfLimpo) {
        continue;
      }

      const valor = Number(resumo.nValPago || 0) || 0;
      if (!valor) continue;

      totalInvestido += valor;
    }

    console.log(
      `✅ Investimento Omie para CPF ${cpfLimpo} em "${propertyName}": total=${totalInvestido}`
    );

    setCache(cacheKey, totalInvestido, TTL_APORTE_PROJETO);
    return totalInvestido;
  } catch (error) {
    console.error(
      "💥 Erro em getInvestorAmountForProject:",
      error?.response?.data || error.message
    );

    setCache(cacheKey, 0, TTL_APORTE_PROJETO);
    return 0;
  }
}

/**
 * 🧮 8) Lucro realizado (Distribuição de Lucros) por operação
 *
 * - Se cpfCnpjFilter for informado:
 *    → soma só as SAÍDAS (P) da categoria 2.10.98 daquele CPF
 * - Se cpfCnpjFilter for null (admin):
 *    → soma todas as SAÍDAS (P) da categoria 2.10.98 do projeto
 */
async function getRealizedProfitForProject(propertyName, cpfCnpjFilter = null) {
  const cpfLimpo =
    cpfCnpjFilter && String(cpfCnpjFilter).trim() !== ""
      ? String(cpfCnpjFilter).replace(/[^\d]/g, "")
      : null;

  const cacheKey = `omie:lucroDistribuido:${propertyName}:${
    cpfLimpo || "ALL"
  }`;

  const cacheHit = getCache(cacheKey);
  if (cacheHit !== null && cacheHit !== undefined) {
    console.log(
      `✅ [CACHE] Lucro distribuído reaproveitado para projeto "${propertyName}" (CPF=${
        cpfLimpo || "TODOS"
      }): total=${cacheHit}`
    );
    return cacheHit;
  }

  try {
    console.log(
      `🔎 Calculando LUCRO REALIZADO (categoria ${COD_CATEGORIA_DISTRIB_LUCROS}) para projeto "${propertyName}"` +
        (cpfLimpo ? ` e CPF ${cpfLimpo}` : " (TODOS os CPFs)")
    );

    const projetos = await listarProjetosOmie();
    const projeto = encontrarProjetoPorDescricao(projetos, propertyName);

    if (!projeto) {
      console.warn(
        `⚠️ Nenhum projeto Omie encontrado com nome = "${propertyName}" ao calcular lucro realizado.`
      );
      setCache(cacheKey, 0, TTL_LUCRO_PROJETO);
      return 0;
    }

    const codigoProjetoOmie = projeto.codigo;

    const movimentos = await listarMovimentosOmieContaCorrente();

    let totalLucro = 0;

    for (const mov of movimentos) {
      const detalhes = mov.detalhes || {};
      const resumo = mov.resumo || {};

      const codProjetoMov = detalhes.cCodProjeto;
      if (String(codProjetoMov) !== String(codigoProjetoOmie)) {
        continue;
      }

      // Lucro distribuído: saída (P)
      const natureza = String(detalhes.cNatureza || "").toUpperCase();
      if (natureza !== "P") {
        continue;
      }

      // Categoria deve ser exatamente 2.10.98
      const categoriaCodigo = String(detalhes.cCodCateg || "");
      if (categoriaCodigo !== COD_CATEGORIA_DISTRIB_LUCROS) {
        continue;
      }

      // Se tiver CPF filtro, só conta se o movimento for desse CPF
      if (cpfLimpo) {
        const cpfMov = String(detalhes.cCPFCNPJCliente || "").replace(
          /[^\d]/g,
          ""
        );
        if (!cpfMov || cpfMov !== cpfLimpo) {
          continue;
        }
      }

      const valor = Number(resumo.nValPago || 0) || 0;
      if (!valor) continue;

      totalLucro += valor;
    }

    console.log(
      `✅ Lucro realizado (Distribuição de Lucros, ${COD_CATEGORIA_DISTRIB_LUCROS}) para "${propertyName}" (CPF=${
        cpfLimpo || "TODOS"
      }): total=${totalLucro}`
    );

    setCache(cacheKey, totalLucro, TTL_LUCRO_PROJETO);
    return totalLucro;
  } catch (error) {
    console.error(
      "💥 Erro em getRealizedProfitForProject:",
      error?.response?.data || error.message
    );
    setCache(cacheKey, 0, TTL_LUCRO_PROJETO);
    return 0;
  }
}

module.exports = {
  getOperationCostsFromOmie,
  getInvestorAmountForProject,
  getRealizedProfitForProject,
};
