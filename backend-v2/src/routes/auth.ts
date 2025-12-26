import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { supabaseAdmin } from "../lib/supabase";

const router = Router();

/* =========================
   Utils
========================= */

const onlyDigits = (s = "") => String(s).replace(/\D/g, "");

function signToken(payload: any) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET não configurado");
  return jwt.sign(payload, secret, { expiresIn: "30d" });
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    if (!token) {
      return res.status(401).json({ ok: false, error: "Sem token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    (req as any).user = decoded;

    next();
  } catch {
    return res.status(401).json({ ok: false, error: "Token inválido" });
  }
}

/* =========================
   ADMIN — Criar senha inicial
========================= */
/**
 * POST /auth/admin/set-initial-password
 * Header: x-admin-key
 * Body: { cpf_cnpj, initialPassword }
 */
router.post("/admin/set-initial-password", async (req: Request, res: Response) => {
  try {
    const adminKey = req.headers["x-admin-key"];

    if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
      return res.status(403).json({ ok: false, error: "Não autorizado" });
    }

    const rawCpf = String(req.body?.cpf_cnpj || "").trim();
    const cpfDigits = onlyDigits(rawCpf);
    const initialPassword = String(req.body?.initialPassword || "");

    if (![11, 14].includes(cpfDigits.length) || initialPassword.length < 8) {
      return res.status(400).json({
        ok: false,
        error: "CPF/CNPJ inválido ou senha fraca (mín. 8 caracteres)",
      });
    }

    // 🔍 Busca flexível (com máscara ou sem)
    const { data: party, error: partyErr } = await supabaseAdmin
      .from("omie_parties")
      .select("id, name, cpf_cnpj, omie_code")
      .or(
        `cpf_cnpj.eq.${rawCpf},cpf_cnpj.eq.${cpfDigits},cpf_cnpj.ilike.%${cpfDigits}%`
      )
      .maybeSingle();

    if (partyErr) throw partyErr;
    if (!party) {
      return res.status(404).json({ ok: false, error: "Pessoa não encontrada" });
    }

    const password_hash = await bcrypt.hash(initialPassword, 12);

    const { error: upsertErr } = await supabaseAdmin
      .from("party_auth")
      .upsert(
        {
          party_id: party.id,
          password_hash,
          must_change_password: true,
        },
        { onConflict: "party_id" }
      );

    if (upsertErr) throw upsertErr;

    return res.json({
      ok: true,
      party: {
        id: party.id,
        name: party.name,
        cpf_cnpj: party.cpf_cnpj,
        omie_code: party.omie_code,
      },
    });
  } catch (err) {
    console.error("set-initial-password error:", err);
    return res.status(500).json({ ok: false, error: "Erro interno" });
  }
});

/* =========================
   LOGIN
========================= */
/**
 * POST /auth/login
 * Body: { cpf_cnpj, password }
 */
/**
 * POST /auth/login
 * Body: { cpf_cnpj, cpf, password }
 * (aceita cpf OU cpf_cnpj para compatibilidade com o mobile)
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const rawCpf = String(
      req.body?.cpf_cnpj || req.body?.cpf || ""
    ).trim();

    const cpfDigits = onlyDigits(rawCpf);
    const password = String(req.body?.password || "");

    if (![11, 14].includes(cpfDigits.length) || !password) {
      return res.status(400).json({ ok: false, error: "Credenciais inválidas" });
    }

    const { data: party, error: partyErr } = await supabaseAdmin
      .from("omie_parties")
      .select("id, name, cpf_cnpj, omie_code")
      .or(
        `cpf_cnpj.eq.${rawCpf},cpf_cnpj.eq.${cpfDigits},cpf_cnpj.ilike.%${cpfDigits}%`
      )
      .maybeSingle();

    if (partyErr) throw partyErr;
    if (!party) {
      return res.status(401).json({ ok: false, error: "Credenciais inválidas" });
    }

    const { data: authRow, error: authErr } = await supabaseAdmin
      .from("party_auth")
      .select("password_hash, must_change_password")
      .eq("party_id", party.id)
      .maybeSingle();

    if (authErr) throw authErr;
    if (!authRow) {
      return res.status(401).json({ ok: false, error: "Usuário sem senha cadastrada" });
    }

    const valid = await bcrypt.compare(password, authRow.password_hash);
    if (!valid) {
      return res.status(401).json({ ok: false, error: "Credenciais inválidas" });
    }

    await supabaseAdmin
      .from("party_auth")
      .update({ last_login_at: new Date().toISOString() })
      .eq("party_id", party.id);

    const token = signToken({
      party_id: party.id,
      cpf_cnpj: party.cpf_cnpj,
    });

    return res.json({
      ok: true,
      token,
      must_change_password: authRow.must_change_password,
      party: {
        id: party.id,
        name: party.name,
        cpf_cnpj: party.cpf_cnpj,
        omie_code: party.omie_code,
      },
    });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ ok: false, error: "Erro interno" });
  }
});


/* =========================
   TROCAR SENHA (usuário)
========================= */
/**
 * POST /auth/change-password
 * Header: Authorization Bearer <token>
 * Body: { oldPassword, newPassword }
 */
router.post(
  "/change-password",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const partyId = user?.party_id;

      const oldPassword = String(req.body?.oldPassword || "");
      const newPassword = String(req.body?.newPassword || "");

      if (!partyId) {
        return res.status(401).json({ ok: false, error: "Usuário inválido" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          ok: false,
          error: "Nova senha deve ter no mínimo 8 caracteres",
        });
      }

      const { data: authRow, error: authErr } = await supabaseAdmin
        .from("party_auth")
        .select("password_hash")
        .eq("party_id", partyId)
        .maybeSingle();

      if (authErr) throw authErr;
      if (!authRow) {
        return res.status(404).json({ ok: false, error: "Credenciais não encontradas" });
      }

      const valid = await bcrypt.compare(oldPassword, authRow.password_hash);
      if (!valid) {
        return res.status(401).json({ ok: false, error: "Senha atual incorreta" });
      }

      const password_hash = await bcrypt.hash(newPassword, 12);

      const { error: updErr } = await supabaseAdmin
        .from("party_auth")
        .update({
          password_hash,
          must_change_password: false,
        })
        .eq("party_id", partyId);

      if (updErr) throw updErr;

      return res.json({ ok: true });
    } catch (err) {
      console.error("change-password error:", err);
      return res.status(500).json({ ok: false, error: "Erro interno" });
    }
  }
);

export default router;
