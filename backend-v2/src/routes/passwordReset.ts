import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import axios from "axios";
import nodemailer from "nodemailer";
import { supabaseAdmin } from "../lib/supabase";

const router = Router();

/* =========================
   Utils
========================= */
const onlyDigits = (v: string) => (v || "").replace(/\D/g, "");
const sha256Hex = (v: string) =>
  crypto.createHash("sha256").update(v).digest("hex");

function getDeepLink(token: string) {
  const base = process.env.APP_RESET_BASE_URL; // triade://reset-password
  if (!base) throw new Error("APP_RESET_BASE_URL não configurado");
  return `${base}?token=${encodeURIComponent(token)}`;
}

function getPublicRedirectLink(token: string) {
  const pub = process.env.PUBLIC_BACKEND_URL; // https://triade-backend.onrender.com
  if (!pub) throw new Error("PUBLIC_BACKEND_URL não configurado");
  return `${pub.replace(/\/$/, "")}/r/reset?token=${encodeURIComponent(token)}`;
}

/* =========================
   EMAIL (RESEND ou SMTP)
========================= */
async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const resendKey = process.env.RESEND_API_KEY;

  // ✅ PRIORIDADE: RESEND (HTTPS - funciona no Render)
  if (resendKey) {
    const fromRaw =
      process.env.RESEND_FROM ||
      process.env.MAIL_FROM ||
      "Triade <onboarding@resend.dev>";

    const from = String(fromRaw).replace(/^"+|"+$/g, "").trim();

    try {
      const resp = await axios.post(
        "https://api.resend.com/emails",
        {
          from,
          to: [params.to],
          subject: params.subject,
          text: params.text,
          html: params.html,
        },
        {
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          timeout: 15000,
        }
      );

      console.log("[resend] email enviado:", resp.data);
      return;
    } catch (e: any) {
      console.log("[resend] ERRO STATUS:", e?.response?.status);
      console.log("[resend] ERRO DATA:", e?.response?.data || e?.message);
      throw e;
    }
  }

  // 🔁 FALLBACK SMTP (local)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
  });
}

/* =========================
   GET /r/reset (redirect)
========================= */
router.get("/r/reset", async (req, res) => {
  const token = String(req.query.token || "");
  if (!token) return res.status(400).send("Token ausente");

  const deepLink = getDeepLink(token);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`
    <html>
      <body style="font-family:Arial;padding:24px">
        <h2>Redefinição de senha</h2>
        <p>Estamos abrindo o app…</p>
        <a href="${deepLink}"
           style="display:inline-block;padding:12px 16px;background:#0E2A47;color:#fff;border-radius:10px;text-decoration:none">
           Abrir no app
        </a>
        <script>
          window.location.href = "${deepLink}";
        </script>
      </body>
    </html>
  `);
});

/* =========================
   POST /auth/forgot-password
========================= */
router.post("/auth/forgot-password", async (req, res) => {
  const neutral = {
    ok: true,
    message:
      "Se existir uma conta com esse CPF, enviaremos um link de redefinição.",
  };

  try {
    const cpf = onlyDigits(req.body?.cpf);
    if (!cpf) return res.json(neutral);

    const { data: party } = await supabaseAdmin
      .from("omie_parties")
      .select("id,email")
      .eq("cpf_cnpj", cpf)
      .maybeSingle();

    if (!party?.id || !party?.email) return res.json(neutral);

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256Hex(token);
    const expiresAt = new Date(
      Date.now() + 30 * 60 * 1000
    ).toISOString();

    await supabaseAdmin
      .from("party_auth")
      .upsert(
        {
          party_id: party.id,
          reset_token_hash: tokenHash,
          reset_token_expires_at: expiresAt,
        },
        { onConflict: "party_id" }
      );

    const redirectLink = getPublicRedirectLink(token);

    await sendEmail({
      to: party.email,
      subject: "Redefinição de senha - Triade",
      text: `Abra no celular:\n${redirectLink}`,
      html: `
        <p>Clique abaixo para redefinir sua senha:</p>
        <p><a href="${redirectLink}">${redirectLink}</a></p>
      `,
    });

    return res.json(neutral);
  } catch (e: any) {
    console.log("[forgot-password] erro:", e?.message);
    return res.json(neutral);
  }
});

/* =========================
   POST /auth/reset-password
========================= */
router.post("/auth/reset-password", async (req, res) => {
  try {
    const token = String(req.body?.token || "");
    const newPassword = String(req.body?.newPassword || "");

    if (!token || newPassword.length < 8) {
      return res.status(400).json({ ok: false });
    }

    const tokenHash = sha256Hex(token);

    const { data: auth } = await supabaseAdmin
      .from("party_auth")
      .select("id,reset_token_expires_at")
      .eq("reset_token_hash", tokenHash)
      .maybeSingle();

    if (!auth?.id) return res.status(400).json({ ok: false });

    if (new Date(auth.reset_token_expires_at).getTime() < Date.now()) {
      return res.status(400).json({ ok: false });
    }

    const password_hash = await bcrypt.hash(newPassword, 12);

    await supabaseAdmin
      .from("party_auth")
      .update({
        password_hash,
        reset_token_hash: null,
        reset_token_expires_at: null,
      })
      .eq("id", auth.id);

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false });
  }
});

export default router;
