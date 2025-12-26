import "dotenv/config";
import { supabaseAdmin } from "../src/lib/supabase";

async function main() {
  console.log("🔍 Testando conexão backend-v2 → Supabase (omie_mf_movements)...");

  const { data, error } = await supabaseAdmin
    .from("omie_mf_movements")
    .select("mf_key")
    .limit(1);

  if (error) {
    console.error("❌ FALHOU no teste do Supabase:");
    console.error(error);
    process.exit(1);
  }

  console.log("✅ OK! Conectou e consultou com sucesso.");
  console.log("📦 Sample:", data);
  process.exit(0);
}

main();
