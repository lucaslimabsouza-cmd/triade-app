// Backend/scripts/sync-omie-ref.js
console.log("🔥 sync-omie-ref.js carregado");

require("dotenv").config({ path: ".env.local" });

const { Pool } = require("pg");
const { callOmie } = require("../services/omieClient");

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente ausente: ${name}`);
  return v;
}

const pool = new Pool({
  connectionString: mustEnv("DATABASE_URL"),
  ssl: { rejectUnauthorized: false },
});

async function listAllOmie({ endpointPath, call, baseParam = {}, arrayFieldGuesses = [] }) {
  const registros_por_pagina = baseParam.registros_por_pagina ?? 200;
  let pagina = 1;
  let totalPaginas = 1;
  const all = [];

  while (pagina <= totalPaginas) {
    const param = [{ ...baseParam, pagina, registros_por_pagina }];

    const data = await callOmie(endpointPath, call, param);

    const tp =
      data?.total_de_paginas ??
      data?.total_de_paginas ??
      data?.totalPaginas ??
      data?.total_paginas ??
      1;

    totalPaginas = Number(tp) || 1;

    let items = null;
    for (const f of arrayFieldGuesses) {
      if (Array.isArray(data?.[f])) {
        items = data[f];
        break;
      }
    }
    if (!items) {
      for (const v of Object.values(data || {})) {
        if (Array.isArray(v)) {
          items = v;
          break;
        }
      }
    }

    const len = items ? items.length : 0;
    console.log(`📥 ${call}: página ${pagina}/${totalPaginas} (${len} itens)`);

    if (items && items.length) all.push(...items);
    pagina += 1;
  }

  return all;
}

async function upsertProjects(client, projects) {
  if (!projects.length) return 0;

  const sql = `
    insert into public.omie_projects (project_code, project_name, updated_at)
    values ($1, $2, now())
    on conflict (project_code)
    do update set project_name = excluded.project_name, updated_at = now()
  `;

  let count = 0;
  for (const p of projects) {
    const project_code = String(p.codigo ?? p.codigo_projeto ?? p.project_code ?? "").trim();
    const project_name = String(p.nome ?? p.descricao ?? p.project_name ?? "").trim();

    if (!project_code) continue;

    await client.query(sql, [project_code, project_name || null]);
    count += 1;
  }
  return count;
}

async function upsertCategories(client, categories) {
  if (!categories.length) return 0;

  const sql = `
    insert into public.omie_categories (category_code, category_name, updated_at)
    values ($1, $2, now())
    on conflict (category_code)
    do update set category_name = excluded.category_name, updated_at = now()
  `;

  let count = 0;
  for (const c of categories) {
    const category_code = String(c.codigo ?? c.category_code ?? "").trim();
    const category_name = String(c.descricao ?? c.category_name ?? "").trim();

    if (!category_code) continue;

    await client.query(sql, [category_code, category_name || null]);
    count += 1;
  }
  return count;
}

async function upsertSuppliers(client, people) {
  if (!people.length) return 0;

  const sql = `
    insert into public.omie_suppliers
      (supplier_code, supplier_name, trade_name, document, email, phone, is_active, updated_at)
    values ($1,$2,$3,$4,$5,$6,$7, now())
    on conflict (supplier_code)
    do update set
      supplier_name = excluded.supplier_name,
      trade_name = excluded.trade_name,
      document = excluded.document,
      email = excluded.email,
      phone = excluded.phone,
      is_active = excluded.is_active,
      updated_at = now()
  `;

  let count = 0;
  for (const s of people) {
    const supplier_code = String(s.codigo_cliente_omie ?? s.codigo_cliente ?? s.codigo ?? "").trim();
    if (!supplier_code) continue;

    const supplier_name = String(s.razao_social ?? s.nome_fantasia ?? s.nome ?? "").trim() || null;
    const trade_name = String(s.nome_fantasia ?? "").trim() || null;
    const document = s.cnpj_cpf ? String(s.cnpj_cpf).replace(/\D/g, "") : null;
    const email = String(s.email ?? s.email_principal ?? "").trim() || null;

    const phone =
      String(
        s.telefone1_numero ??
          s.telefone1 ??
          s.fone ??
          s.telefone ??
          ""
      ).trim() || null;

    const is_active = String(s.inativo ?? "N").toUpperCase() !== "S";

    await client.query(sql, [supplier_code, supplier_name, trade_name, document, email, phone, is_active]);
    count += 1;
  }

  return count;
}

async function main() {
  console.log("🚀 Entrou no main()");

  const client = await pool.connect();
  try {
    // 1) Projetos
    console.log("\n🧩 Baixando Projetos (Omie)...");
    const projects = await listAllOmie({
      endpointPath: "/geral/projetos/",
      call: "ListarProjetos",
      baseParam: { apenas_importado_api: "N" },
      arrayFieldGuesses: ["cadastro", "projetos", "projeto", "cadastros"],
    });

    console.log(`💾 Gravando ${projects.length} projetos no Postgres...`);
    const nP = await upsertProjects(client, projects);
    console.log(`✅ Projetos upserted: ${nP}`);

    // 2) Categorias
    console.log("\n🧩 Baixando Categorias (Omie)...");
    const categories = await listAllOmie({
      endpointPath: "/geral/categorias/",
      call: "ListarCategorias",
      baseParam: {},
      arrayFieldGuesses: ["categoria_cadastro", "categorias", "cadastro", "categoria"],
    });

    console.log(`💾 Gravando ${categories.length} categorias no Postgres...`);
    const nC = await upsertCategories(client, categories);
    console.log(`✅ Categorias upserted: ${nC}`);

    // 3) Fornecedores (Omie usa clientes cadastro; vamos syncar todos e depois filtrar)
    console.log("\n🧩 Baixando Clientes/Fornecedores (Omie)...");
    const people = await listAllOmie({
      endpointPath: "/geral/clientes/",
      call: "ListarClientes",
      baseParam: { apenas_importado_api: "N" },
      arrayFieldGuesses: ["clientes_cadastro", "cliente_cadastro", "clientes", "cadastro"],
    });

    console.log(`💾 Gravando ${people.length} cadastros no Postgres...`);
    const nS = await upsertSuppliers(client, people);
    console.log(`✅ Cadastros upserted: ${nS}`);

    console.log("\n🎉 Sync finalizado.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(async (err) => {
  console.error("❌ Erro no sync:", err?.message || err);
  try { await pool.end(); } catch {}
  process.exit(1);
});
