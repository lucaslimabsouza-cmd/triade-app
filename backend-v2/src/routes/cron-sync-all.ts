import { Router } from "express";
import { syncAll } from "../services/cron/syncAll";
import { syncOmieMfMovements } from "../services/cron/syncOmieMfMovements";
import { syncOmieParties } from "../services/cron/syncOmieParties";
import { syncOmieCategories } from "../services/cron/syncOmieCategories";
import { syncOmieProjects } from "../services/cron/syncOmieProjects";
import { syncOmieAccountsPayable } from "../services/cron/syncOmieAccountsPayable";
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

// ✅ Endpoint de teste para omie_parties
router.post("/cron/test-omie-parties", requireAdmin, async (req, res) => {
  try {
    const fullSync = req.query.fullSync === "true";
    logger.info("[cron/test-omie-parties] Iniciando sincronização", { fullSync });
    const result = await syncOmieParties({ fullSync });
    logger.info("[cron/test-omie-parties] Sincronização concluída", result);
    return res.json({ ok: true, ...result });
  } catch (e: any) {
    logger.error("[cron/test-omie-parties] error", e);
    return res.status(500).json({ ok: false, error: e?.message || "Erro interno" });
  }
});

// ✅ Endpoint de teste para omie_categories
router.post("/cron/test-omie-categories", requireAdmin, async (req, res) => {
  try {
    const fullSync = req.query.fullSync === "true";
    logger.info("[cron/test-omie-categories] Iniciando sincronização", { fullSync });
    const result = await syncOmieCategories({ fullSync });
    logger.info("[cron/test-omie-categories] Sincronização concluída", result);
    return res.json({ ok: true, ...result });
  } catch (e: any) {
    logger.error("[cron/test-omie-categories] error", e);
    return res.status(500).json({ ok: false, error: e?.message || "Erro interno" });
  }
});

// ✅ Endpoint de teste para omie_projects
router.post("/cron/test-omie-projects", requireAdmin, async (req, res) => {
  try {
    const fullSync = req.query.fullSync === "true";
    logger.info("[cron/test-omie-projects] Iniciando sincronização", { fullSync });
    const result = await syncOmieProjects({ fullSync });
    logger.info("[cron/test-omie-projects] Sincronização concluída", result);
    return res.json({ ok: true, ...result });
  } catch (e: any) {
    logger.error("[cron/test-omie-projects] error", e);
    return res.status(500).json({ ok: false, error: e?.message || "Erro interno" });
  }
});

// ✅ Endpoint de teste para omie_accounts_payable
router.post("/cron/test-omie-accounts-payable", requireAdmin, async (req, res) => {
  try {
    const fullSync = req.query.fullSync === "true";
    logger.info("[cron/test-omie-accounts-payable] Iniciando sincronização", { fullSync });
    const result = await syncOmieAccountsPayable({ fullSync });
    logger.info("[cron/test-omie-accounts-payable] Sincronização concluída", result);
    return res.json({ ok: true, ...result });
  } catch (e: any) {
    logger.error("[cron/test-omie-accounts-payable] error", e);
    return res.status(500).json({ ok: false, error: e?.message || "Erro interno" });
  }
});

export default router;
