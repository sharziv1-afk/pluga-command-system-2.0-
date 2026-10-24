import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

// Supabase's built-in SMTP mailer is not usable in production (team-members-only,
// heavily rate-limited) and Supabase's GoTrue SMTP client could not complete a
// real delivery via Resend's SMTP relay (587 timed out mid-transaction, 465
// failed auth despite the same credentials working outside Supabase). This
// hook bypasses SMTP entirely and calls Resend's REST API directly.
//
// Set these as Edge Function secrets before deployment. The sender must use a
// domain verified in Resend; its test sender can only mail the account owner.
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")?.trim() ?? "";
const HOOK_SECRET = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "").replace("v1,whsec_", "").trim();
const SEND_EMAIL_FROM = Deno.env.get("SEND_EMAIL_FROM")?.trim() ?? "";

interface HookPayload {
  user: { email: string };
  email_data: { token: string; email_action_type: string };
}

function buildHtml(token: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
  <body style="font-family: sans-serif; text-align: center; padding: 40px;">
    <h2>המפקד</h2>
    <p>קוד האימות שלך:</p>
    <p style="font-size: 36px; font-weight: bold; letter-spacing: 8px;">${token}</p>
    <p style="color: #666;">הקוד תקף ל-10 דקות.</p>
  </body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  if (!RESEND_API_KEY || !HOOK_SECRET || !SEND_EMAIL_FROM) {
    console.error("send-email configuration is incomplete");
    return new Response(JSON.stringify({ error: { message: "email delivery unavailable" } }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  const wh = new Webhook(HOOK_SECRET);

  let data: HookPayload;
  try {
    data = wh.verify(payload, headers) as HookPayload;
  } catch {
    return new Response(JSON.stringify({ error: { message: "invalid signature" } }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const email = data.user?.email;
  const token = data.email_data?.token;
  if (!email || !token) {
    return new Response(
      JSON.stringify({ error: { message: "missing user.email or email_data.token" } }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: SEND_EMAIL_FROM,
      to: [email],
      subject: "קוד אימות - המפקד",
      html: buildHtml(token),
    }),
  });

  if (!resendResponse.ok) {
    // Do not echo provider responses into Auth logs: they may include private
    // recipient or account details. The status is enough to find the request.
    console.error("Resend send failed", resendResponse.status);
    return new Response(
      JSON.stringify({ error: { message: "email delivery unavailable" } }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
});
