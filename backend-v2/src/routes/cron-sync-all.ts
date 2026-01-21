import { Router } from "express";
import { syncAll } from "../services/cron/syncAll";

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
    console.log("[cron/sync-all] error:", e?.message || e);
    return res.status(500).json({ ok: false, error: e?.message || "Erro interno" });
  }
});

export default router;
