import { Router } from "express";
import { syncAll } from "../services/cron/syncAll";
import { syncOmieMfMovements } from "../services/cron/syncOmieMfMovements";
import { logger } from "../lib/logger";

const router = Router();

function requireAdmin(req: any, res: any, next: any) {
  const got = String(req.headers["x-admin-key"] || "");
  const expected = String(process.env.ADMIN_API_KEY || "");
  if (!expected) return res.status(500).json({ ok: false, error: "ADMIN_API_KEY não configurada" });
  if (!got || got !== expected) return res.status(401).json({ ok: false, error: "Unauthorized" });
  return next();
}

router.post("/cron/sync-all", requireAdmin, async (_req, res) => {
  try {
    const result = await syncAll();
    return res.json({ ok: true, ...result });
  } catch (e: any) {
    logger.error("[cron/sync-all] error", e);
    return res.status(500).json({ ok: false, error: e?.message || "Erro interno" });
  }
});

// ✅ Endpoint de teste específico para omie_mf_movements
// Query params: 
//   ?fullSync=true (busca tudo, ignora sync_state)
//   ?forceDays=30 (força buscar últimos N dias)
router.post("/cron/test-omie-mf-movements", requireAdmin, async (req, res) => {
  try {
    const fullSync = req.query.fullSync === "true";
    const forceDays = req.query.forceDays ? Number(req.query.forceDays) : undefined;
    
    logger.info("[cron/test-omie-mf-movements] Iniciando sincronização", { fullSync, forceDays });
    const result = await syncOmieMfMovements({ fullSync, forceDays });
    logger.info("[cron/test-omie-mf-movements] Sincronização concluída", result);
    return res.json({ ok: true, ...result });
  } catch (e: any) {
    logger.error("[cron/test-omie-mf-movements] error", e);
    return res.status(500).json({ ok: false, error: e?.message || "Erro interno" });
  }
});

export default router;
