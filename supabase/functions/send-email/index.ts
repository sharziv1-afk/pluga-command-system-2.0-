import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

// Supabase's built-in SMTP mailer is not usable in production (team-members-only,
// heavily rate-limited) and Supabase's GoTrue SMTP client could not complete a
// real delivery via Resend's SMTP relay (587 timed out mid-transaction, 465
// failed auth despite the same credentials working outside Supabase). This
// hook bypasses SMTP entirely and calls Resend's REST API directly.
//
// Requires these secrets set via `supabase secrets set` (or the Dashboard):
//   RESEND_API_KEY          - Resend API key
//   SEND_EMAIL_HOOK_SECRET  - the "v1,whsec_..." secret shown when the
//                              Send Email Hook is created in
//                              Authentication > Hooks in the Supabase Dashboard
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const HOOK_SECRET = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "").replace("v1,whsec_", "");

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
      from: "המפקד <onboarding@resend.dev>",
      to: [email],
      subject: "קוד אימות - המפקד",
      html: buildHtml(token),
    }),
  });

  if (!resendResponse.ok) {
    const errText = await resendResponse.text();
    return new Response(
      JSON.stringify({ error: { http_code: resendResponse.status, message: errText } }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
});
