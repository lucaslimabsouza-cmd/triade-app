import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { supabaseAdmin } from "../lib/supabase";

const router = Router();

const onlyDigits = (v: string) => (v || "").replace(/\D/g, "");
const sha256Hex = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

function getDeepLink(token: string) {
  const base = process.env.APP_RESET_BASE_URL; // exp://.../--/reset-password OR triade://reset-password
  if (!base) throw new Error("APP_RESET_BASE_URL não configurado");
  return `${base}?token=${encodeURIComponent(token)}`;
}

function getPublicRedirectLink(token: string) {
  const pub = process.env.PUBLIC_BACKEND_URL; // ex: http://11.0.3.3:4001
  if (!pub) throw new Error("PUBLIC_BACKEND_URL não configurado");
  return `${pub.replace(/\/$/, "")}/r/reset?token=${encodeURIComponent(token)}`;
}

function getMailer() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) throw new Error("SMTP envs faltando");

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

/* =========================
   Redirect clicável (HTTPS/HTTP)
   GET /r/reset?token=...
   - abre uma página simples que redireciona para exp:// ou triade://
========================= */
router.get("/r/reset", async (req, res) => {
  const token = String(req.query?.token || "");
  if (!token) return res.status(400).send("Token ausente.");

  let deepLink = "";
  try {
    deepLink = getDeepLink(token);
  } catch {
    return res.status(500).send("Configuração de deep link ausente.");
  }

  // HTML com botão e tentativa automática de abrir o deep link
  // + fallback copiável
  return res
    .status(200)
    .setHeader("Content-Type", "text/html; charset=utf-8")
    .send(`
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Redefinir senha</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; line-height: 1.4; }
      .btn { display:inline-block; padding: 12px 16px; background:#0E2A47; color:#fff; border-radius:10px; text-decoration:none; }
      code { word-break: break-all; display:block; background:#f5f5f5; padding:12px; border-radius:10px; }
    </style>
  </head>
  <body>
    <h2>Redefinição de senha</h2>
    <p>Estamos abrindo o app para você redefinir a senha.</p>

    <p><a class="btn" href="${deepLink}">Abrir no app</a></p>

    <p>Se não abrir automaticamente, copie e cole este link no navegador do celular:</p>
    <code>${deepLink}</code>

    <script>
      // tenta abrir automático
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
    message: "Se existir uma conta com esse CPF, enviaremos um link de redefinição.",
  };

  try {
    const cpf = onlyDigits(req.body?.cpf);
    if (!cpf) return res.status(400).json({ ok: false, error: "CPF obrigatório" });

    const { data: party, error: partyErr } = await supabaseAdmin
      .from("omie_parties")
      .select("id,email")
      .eq("cpf_cnpj", cpf)
      .maybeSingle();

    if (partyErr || !party?.id || !party?.email) return res.json(neutral);

    const ttlMin = Number(process.env.RESET_TOKEN_TTL_MINUTES || "30");
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256Hex(token);
    const expiresAt = new Date(Date.now() + ttlMin * 60 * 1000).toISOString();

    const updatePayload = {
      reset_token_hash: tokenHash,
      reset_token_expires_at: expiresAt,
      reset_token_sent_at: new Date().toISOString(),
    };

    const { error: updErr, data: updData } = await supabaseAdmin
      .from("party_auth")
      .update(updatePayload)
      .eq("party_id", party.id)
      .select("id")
      .maybeSingle();

    if (updErr || !updData?.id) {
      const { error: upsertErr, data: upsertData } = await supabaseAdmin
        .from("party_auth")
        .upsert({ party_id: party.id, ...updatePayload }, { onConflict: "party_id" })
        .select("id")
        .maybeSingle();

      if (upsertErr || !upsertData?.id) return res.json(neutral);
    }

    const deepLink = getDeepLink(token);
    const redirectLink = getPublicRedirectLink(token);

    console.log("RESET deepLink =", deepLink);
    console.log("RESET redirectLink =", redirectLink);

    const transporter = getMailer();
    const from = process.env.MAIL_FROM || process.env.SMTP_FROM || "Triade <no-reply@triade.com.br>";

    // ✅ mandamos o link HTTP/HTTPS clicável (redirect)
    await transporter.sendMail({
      from,
      to: party.email,
      subject: "Redefinição de senha - Triade",
      text:
        `Você solicitou a redefinição de senha.\n\n` +
        `Abra este link no celular:\n${redirectLink}\n\n` +
        `Se precisar copiar o deep link:\n${deepLink}\n`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height:1.5; color:#111;">
          <h2 style="margin:0 0 12px;">Redefinição de senha</h2>
          <p style="margin:0 0 12px;">Abra no celular:</p>

          <p style="margin:0 0 16px;">
            <a href="${redirectLink}"
               style="display:inline-block; padding:12px 16px; background:#0E2A47; color:#fff; text-decoration:none; border-radius:10px;">
              Abrir para redefinir
            </a>
          </p>

          <p style="margin:0 0 8px; color:#444;">
            Se preferir, copie e cole este link no navegador do celular:
          </p>
          <p style="margin:0 0 16px; word-break:break-all;">
            <a href="${redirectLink}" style="color:#0E2A47; text-decoration:underline;">${redirectLink}</a>
          </p>

          <hr style="border:none; border-top:1px solid #eee; margin:16px 0;" />
          <p style="margin:0; color:#666; font-size:12px;">
            Se você não solicitou, ignore este e-mail.
          </p>
        </div>
      `,
    });

    return res.json(neutral);
  } catch (e: any) {
    console.log("[forgot-password] catch error:", e?.message || e);
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

    if (!token) return res.status(400).json({ ok: false, error: "Token obrigatório" });
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ ok: false, error: "Senha deve ter pelo menos 8 caracteres" });
    }

    const tokenHash = sha256Hex(token);

    const { data: authRow, error: findErr } = await supabaseAdmin
      .from("party_auth")
      .select("id,reset_token_expires_at")
      .eq("reset_token_hash", tokenHash)
      .maybeSingle();

    if (findErr || !authRow?.id) return res.status(400).json({ ok: false, error: "Token inválido" });

    const expMs = authRow.reset_token_expires_at ? new Date(authRow.reset_token_expires_at).getTime() : 0;
    if (!expMs || expMs < Date.now()) return res.status(400).json({ ok: false, error: "Token expirado" });

    const password_hash = await bcrypt.hash(newPassword, 12);

    const { error: updErr } = await supabaseAdmin
      .from("party_auth")
      .update({
        password_hash,
        reset_token_hash: null,
        reset_token_expires_at: null,
        reset_token_sent_at: null,
      })
      .eq("id", authRow.id);

    if (updErr) return res.status(500).json({ ok: false, error: "Falha ao atualizar senha" });

    return res.json({ ok: true });
  } catch (e: any) {
    console.log("[reset-password] catch error:", e?.message || e);
    return res.status(500).json({ ok: false, error: "Erro interno" });
  }
});

export default router;
