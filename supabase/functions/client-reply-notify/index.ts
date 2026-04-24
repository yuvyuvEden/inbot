import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body
    const { invoice_id, comment_body } = await req.json();
    if (!invoice_id || !comment_body?.trim()) {
      return new Response(
        JSON.stringify({ error: "invoice_id and comment_body are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch invoice
    const { data: invoice, error: invErr } = await supabaseAdmin
      .from("invoices")
      .select("id, client_id, vendor, invoice_number")
      .eq("id", invoice_id)
      .maybeSingle();

    if (invErr || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch client (brand_name)
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("brand_name")
      .eq("id", invoice.client_id)
      .maybeSingle();

    // Fetch active accountant assignment
    const { data: assignment } = await supabaseAdmin
      .from("accountant_clients")
      .select("accountant_id")
      .eq("client_id", invoice.client_id)
      .is("unassigned_at", null)
      .maybeSingle();

    if (!assignment?.accountant_id) {
      return new Response(
        JSON.stringify({ success: true, email_sent: false, reason: "no_accountant_assigned" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch accountant user_id
    const { data: accountant } = await supabaseAdmin
      .from("accountants")
      .select("user_id, email, name")
      .eq("id", assignment.accountant_id)
      .maybeSingle();

    if (!accountant) {
      return new Response(
        JSON.stringify({ success: true, email_sent: false, reason: "accountant_not_found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve accountant email — prefer auth.users email, fallback to accountants.email
    let accountantEmail: string | null = null;
    if (accountant.user_id) {
      const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(accountant.user_id);
      accountantEmail = userRes?.user?.email ?? null;
    }
    if (!accountantEmail) accountantEmail = accountant.email ?? null;

    if (!accountantEmail) {
      return new Response(
        JSON.stringify({ success: true, email_sent: false, reason: "no_accountant_email" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vendor = invoice.vendor ?? "ספק לא ידוע";
    const invNum = invoice.invoice_number ?? "";
    const clientName = client?.brand_name ?? "לקוח";
    const dashboardUrl = `https://app.inbot.co.il/accountant/client/${invoice.client_id}`;

    const subject = `[INBOT] תשובת לקוח — חשבונית ${vendor}${invNum ? ` #${invNum}` : ""}`;

    const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;700&display=swap" rel="stylesheet" />
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9; font-family:'Heebo', Arial, sans-serif;">
  <div style="max-width:600px; margin:32px auto; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
    <div style="background-color:#1e3a5f; padding:24px; text-align:center;">
      <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:700;">תשובה חדשה מלקוח</h1>
    </div>
    <div style="padding:28px 32px; color:#1e3a5f;">
      <p style="margin:0 0 16px; font-size:15px; color:#475569;">
        <strong style="color:#1e3a5f;">${escapeHtml(clientName)}</strong> השיב/ה על חשבונית.
      </p>

      <div style="margin:20px 0; padding:16px 18px; background-color:#fff7ed; border-right:4px solid #e8941a; border-radius:8px;">
        <p style="margin:0; font-size:14px; color:#1e3a5f; line-height:1.6; white-space:pre-wrap;">${escapeHtml(comment_body)}</p>
      </div>

      <div style="margin:24px 0; padding:14px 16px; background-color:#f8fafc; border-radius:8px; font-size:14px; color:#475569;">
        <div style="margin-bottom:6px;"><strong style="color:#1e3a5f;">ספק:</strong> ${escapeHtml(vendor)}</div>
        ${invNum ? `<div><strong style="color:#1e3a5f;">מספר חשבונית:</strong> ${escapeHtml(invNum)}</div>` : ""}
      </div>

      <div style="text-align:center; margin:28px 0 8px;">
        <a href="${dashboardUrl}" style="display:inline-block; padding:12px 28px; background-color:#e8941a; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:600; font-size:15px;">
          פתח בדשבורד
        </a>
      </div>
    </div>
    <div style="padding:16px; background-color:#f8fafc; text-align:center; font-size:12px; color:#94a3b8;">
      INBOT — מערכת ניהול חשבוניות חכמה
    </div>
  </div>
</body>
</html>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "INBOT <notifications@inbot.co.il>",
        to: [accountantEmail],
        subject,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error("Resend error:", resendRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true, email_sent: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("client-reply-notify error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
