"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const axios_1 = __importDefault(require("axios"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const supabase_1 = require("../lib/supabase");
const router = (0, express_1.Router)();
/* =========================
   Utils
========================= */
const onlyDigits = (v) => (v || "").replace(/\D/g, "");
const sha256Hex = (v) => crypto_1.default.createHash("sha256").update(v).digest("hex");
function stripQuotes(v) {
    return String(v ?? "").replace(/^"+|"+$/g, "").trim();
}
function sanitizeEmailFrom(v) {
    const raw = String(v ?? "");
    const cleaned = raw
        .replace(/^"+|"+$/g, "")
        .replace(/[\r\n]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    return { raw, cleaned };
}
function isValidFromFormat(from) {
    const plain = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
    const named = /^.+\s<[^<>\s@]+@[^<>\s@<>]+\.[^\s@<>]+>$/;
    return plain.test(from) || named.test(from);
}
/** formata CPF 12398921603 -> 123.989.216-03 */
function maskCpf(digits11) {
    const d = onlyDigits(digits11);
    if (d.length !== 11)
        return "";
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}
/** formata CNPJ 12345678000190 -> 12.345.678/0001-90 */
function maskCnpj(digits14) {
    const d = onlyDigits(digits14);
    if (d.length !== 14)
        return "";
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}
function getDeepLink(token) {
    const base = stripQuotes(process.env.APP_RESET_BASE_URL); // triade://reset-password
    if (!base)
        throw new Error("APP_RESET_BASE_URL não configurado");
    return `${base}?token=${encodeURIComponent(token)}`;
}
function getPublicRedirectLink(token) {
    const pub = stripQuotes(process.env.PUBLIC_BACKEND_URL); // https://triade-backend.onrender.com
    if (!pub)
        throw new Error("PUBLIC_BACKEND_URL não configurado");
    return `${pub.replace(/\/$/, "")}/r/reset?token=${encodeURIComponent(token)}`;
}
/**
 * ✅ Helper: encontra omie_parties por CPF/CNPJ com OU sem pontuação
 * IMPORTANTE: ilike com digits NÃO funciona quando o banco guarda mascarado.
 * Então fazemos match por candidatos: raw, digits, masked gerado.
 */
async function findPartyByCpf(rawCpf) {
    const raw = String(rawCpf ?? "").trim();
    const digits = onlyDigits(raw);
    if (![11, 14].includes(digits.length))
        return null;
    const candidates = new Set();
    if (raw)
        candidates.add(raw);
    if (digits)
        candidates.add(digits);
    if (digits.length === 11)
        candidates.add(maskCpf(digits));
    if (digits.length === 14)
        candidates.add(maskCnpj(digits));
    const list = Array.from(candidates).filter(Boolean);
    const { data: parties, error } = await supabase_1.supabaseAdmin
        .from("omie_parties")
        .select("id,email,cpf_cnpj,name,omie_code")
        .in("cpf_cnpj", list)
        .limit(5);
    if (error)
        throw error;
    // se vier mais de 1 (raríssimo), preferir o que tem email
    const best = (parties ?? []).find((p) => String(p?.email ?? "").trim()) ??
        (parties ?? [])[0] ??
        null;
    return best;
}
/* =========================
   Mail: Resend (prod) + SMTP (fallback)
========================= */
function getMailerSMTP() {
    const host = stripQuotes(process.env.SMTP_HOST);
    const port = Number(stripQuotes(process.env.SMTP_PORT || "587"));
    const user = stripQuotes(process.env.SMTP_USER);
    const pass = stripQuotes(process.env.SMTP_PASS);
    if (!host || !user || !pass)
        throw new Error("SMTP envs faltando");
    const secure = port === 465;
    return nodemailer_1.default.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
        requireTLS: !secure,
        tls: { rejectUnauthorized: false },
    });
}
async function sendEmail(params) {
    const resendKey = stripQuotes(process.env.RESEND_API_KEY);
    // ✅ Preferência: Resend (HTTPS)
    if (resendKey) {
        const fromEnv = process.env.RESEND_FROM || "Triade <reset@espacopart.com.br>";
        const { raw, cleaned } = sanitizeEmailFrom(fromEnv);
        if (!isValidFromFormat(cleaned)) {
            console.log("[resend] INVALID RESEND_FROM raw =", JSON.stringify(raw));
            console.log("[resend] INVALID RESEND_FROM cleaned =", JSON.stringify(cleaned));
            throw new Error("RESEND_FROM inválido no env");
        }
        try {
            const resp = await axios_1.default.post("https://api.resend.com/emails", {
                from: cleaned,
                to: [params.to],
                subject: params.subject,
                text: params.text,
                html: params.html,
            }, {
                headers: {
                    Authorization: `Bearer ${resendKey}`,
                    "Content-Type": "application/json",
                },
                timeout: 15000,
            });
            console.log("[resend] sent ok:", resp?.data);
            return { provider: "resend" };
        }
        catch (e) {
            console.log("[resend] error status:", e?.response?.status);
            console.log("[resend] error data:", e?.response?.data || e?.message || e);
            throw e;
        }
    }
    // 🔁 Fallback: SMTP
    const transporter = getMailerSMTP();
    const fromSMTP = stripQuotes(process.env.MAIL_FROM) ||
        stripQuotes(process.env.SMTP_FROM) ||
        "Triade <no-reply@triade.com.br>";
    await transporter.sendMail({
        from: fromSMTP,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
    });
    return { provider: "smtp" };
}
/* =========================
   Redirect clicável
   GET /r/reset?token=...
========================= */
router.get("/r/reset", async (req, res) => {
    const token = String(req.query?.token || "");
    if (!token)
        return res.status(400).send("Token ausente.");
    let deepLink = "";
    try {
        deepLink = getDeepLink(token);
    }
    catch {
        return res.status(500).send("Configuração de deep link ausente.");
    }
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
        const rawCpf = String(req.body?.cpf ?? "").trim();
        const digits = onlyDigits(rawCpf);
        if (!digits)
            return res.status(400).json({ ok: false, error: "CPF obrigatório" });
        const party = await findPartyByCpf(rawCpf);
        // não vaza info se não achou / não tem email
        if (!party?.id || !String(party?.email ?? "").trim()) {
            console.log("[forgot-password] party not found or missing email. rawCpf=", rawCpf);
            return res.json(neutral);
        }
        const ttlMin = Number(stripQuotes(process.env.RESET_TOKEN_TTL_MINUTES || "30"));
        const token = crypto_1.default.randomBytes(32).toString("hex");
        const tokenHash = sha256Hex(token);
        const expiresAt = new Date(Date.now() + ttlMin * 60 * 1000).toISOString();
        const updatePayload = {
            reset_token_hash: tokenHash,
            reset_token_expires_at: expiresAt,
            reset_token_sent_at: new Date().toISOString(),
        };
        // update -> se não existir, upsert
        const { error: updErr, data: updData } = await supabase_1.supabaseAdmin
            .from("party_auth")
            .update(updatePayload)
            .eq("party_id", party.id)
            .select("id")
            .maybeSingle();
        if (updErr || !updData?.id) {
            const { error: upsertErr, data: upsertData } = await supabase_1.supabaseAdmin
                .from("party_auth")
                .upsert({ party_id: party.id, ...updatePayload }, { onConflict: "party_id" })
                .select("id")
                .maybeSingle();
            if (upsertErr || !upsertData?.id) {
                console.log("[forgot-password] failed to upsert party_auth:", upsertErr?.message);
                return res.json(neutral);
            }
        }
        const deepLink = getDeepLink(token);
        const redirectLink = getPublicRedirectLink(token);
        console.log("RESET cpf(raw) =", rawCpf, "digits =", digits, "party.cpf_cnpj =", party.cpf_cnpj);
        console.log("RESET redirectLink =", redirectLink);
        const subject = "Redefinição de senha - Triade";
        const text = `Você solicitou a redefinição de senha.\n\n` +
            `Abra este link no celular:\n${redirectLink}\n\n` +
            `Se precisar copiar o deep link:\n${deepLink}\n`;
        const html = `
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
    `;
        const sent = await sendEmail({
            to: String(party.email).trim(),
            subject,
            text,
            html,
        });
        console.log("[forgot-password] email sent via:", sent.provider);
        return res.json(neutral);
    }
    catch (e) {
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
        if (!token)
            return res.status(400).json({ ok: false, error: "Token obrigatório" });
        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ ok: false, error: "Senha deve ter pelo menos 8 caracteres" });
        }
        const tokenHash = sha256Hex(token);
        const { data: authRow, error: findErr } = await supabase_1.supabaseAdmin
            .from("party_auth")
            .select("id,reset_token_expires_at")
            .eq("reset_token_hash", tokenHash)
            .maybeSingle();
        if (findErr || !authRow?.id)
            return res.status(400).json({ ok: false, error: "Token inválido" });
        const expMs = authRow.reset_token_expires_at
            ? new Date(authRow.reset_token_expires_at).getTime()
            : 0;
        if (!expMs || expMs < Date.now())
            return res.status(400).json({ ok: false, error: "Token expirado" });
        const password_hash = await bcryptjs_1.default.hash(newPassword, 12);
        const { error: updErr } = await supabase_1.supabaseAdmin
            .from("party_auth")
            .update({
            password_hash,
            must_change_password: false,
            reset_token_hash: null,
            reset_token_expires_at: null,
            reset_token_sent_at: null,
        })
            .eq("id", authRow.id);
        if (updErr)
            return res.status(500).json({ ok: false, error: "Falha ao atualizar senha" });
        return res.json({ ok: true });
    }
    catch (e) {
        console.log("[reset-password] catch error:", e?.message || e);
        return res.status(500).json({ ok: false, error: "Erro interno" });
    }
});
exports.default = router;
