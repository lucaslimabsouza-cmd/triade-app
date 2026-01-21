import { supabaseAdmin } from "../../lib/supabase";

export async function getLastSyncAt(source: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("sync_state")
    .select("last_sync_at")
    .eq("source", source)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data?.last_sync_at as any) ?? null;
}

export async function setLastSyncAt(source: string, iso: string) {
  const { error } = await supabaseAdmin
    .from("sync_state")
    .upsert({ source, last_sync_at: iso, updated_at: new Date().toISOString() }, { onConflict: "source" });

  if (error) throw new Error(error.message);
}
