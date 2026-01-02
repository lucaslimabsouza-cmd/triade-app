import { Router, Request, Response } from "express";
import { requireAuth } from "./auth";
import { supabaseAdmin } from "../lib/supabase";

const router = Router();

/**
 * POST /push/token
 * body: { expo_push_token: string }
 */
router.post("/token", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const partyId = String(user?.party_id ?? "").trim();
    if (!partyId) return res.status(401).json({ ok: false, error: "NO_PARTY_ID_IN_TOKEN" });

    const expo_push_token = String(req.body?.expo_push_token ?? "").trim();
    if (!expo_push_token) return res.status(400).json({ ok: false, error: "MISSING_EXPO_PUSH_TOKEN" });

    const { error } = await supabaseAdmin
      .from("push_tokens")
      .upsert({ party_id: partyId, expo_push_token, updated_at: new Date().toISOString() });

    if (error) return res.status(500).json({ ok: false, error: "DB_ERROR", details: error.message });

    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR", details: err?.message ?? String(err) });
  }
});

export default router;
