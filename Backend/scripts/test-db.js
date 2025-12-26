require("dotenv").config({ path: ".env.local" });
const { Pool } = require("pg");

(async () => {
  console.log("🔎 Iniciando teste de conexão...");

  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL não encontrado no .env.local");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const r = await pool.query("select now() as now");
    console.log("✅ Conectou no Postgres! now =", r.rows[0].now);
    process.exit(0);
  } catch (e) {
    console.error("❌ Falha ao conectar no Postgres:", e.message);
    process.exit(1);
  }
})();
