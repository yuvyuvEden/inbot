import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Admin client (service_role) — לגישה ל-auth.users
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── Caller client — לאימות זהות הרו"ח
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // ── אימות זהות — חייב להיות accountant או admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAccountant = (roles || []).some((r: any) => r.role === "accountant" || r.role === "admin");
    if (!isAccountant) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse body
    const { invoice_id, body: messageBody, subject } = await req.json();
    if (!invoice_id || !messageBody?.trim()) {
      return new Response(JSON.stringify({ error: "invoice_id and body are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── שליפת פרטי החשבונית + לקוח
    const { data: invoice, error: invError } = await supabaseAdmin
      .from("invoices")
      .select("id, client_id, vendor, invoice_number, status")
      .eq("id", invoice_id)
      .single();

    if (invError || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── שליפת פרטי הלקוח
    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id, brand_name, user_id")
      .eq("id", invoice.client_id)
      .single();

    if (clientError || !client) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── שליפת מייל הלקוח מ-auth.users (דורש service_role)
    let clientEmail: string | null = null;
    if (client.user_id) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(client.user_id);
      clientEmail = authUser?.user?.email ?? null;
    }

    if (!clientEmail) {
      return new Response(JSON.stringify({ error: "Client email not found" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── שליפת פרטי הרו"ח השולח
    const { data: accountant } = await supabaseAdmin
      .from("accountants")
      .select("name, email")
      .eq("user_id", user.id)
      .single();

    const accountantName = accountant?.name ?? "רואה החשבון שלך";

    // ── שליפת פרטי הרו"ח השולח
    const { data: accountant } = await supabaseAdmin
      .from("accountants")
      .select("name, email")
      .eq("user_id", user.id)
      .single();

    const accountantName = accountant?.name ?? "רואה החשבון שלך";

    const inbotDomain = Deno.env.get("INBOT_DOMAIN") ?? "inbot.app";

    // ── עדכון סטטוס חשבונית ל-needs_clarification
    const { error: statusError } = await supabaseAdmin
      .from("invoices")
      .update({
        status: "needs_clarification",
        updated_by: user.id,
      })
      .eq("id", invoice_id);

    if (statusError) {
      return new Response(JSON.stringify({ error: statusError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── יצירת invoice_comment
    const { error: commentError } = await supabaseAdmin
      .from("invoice_comments")
      .insert({
        invoice_id,
        author_id: user.id,
        author_role: "accountant",
        body: messageBody.trim(),
      });

    if (commentError) {
      console.error("Failed to create comment:", commentError.message);
    }

    // ── שליחת מייל דרך Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? `notifications@${inbotDomain}`;

    if (!resendKey) {
      // Resend לא מוגדר — נחזיר הצלחה חלקית (comment נוצר, מייל לא נשלח)
      return new Response(
        JSON.stringify({ success: true, email_sent: false, reason: "RESEND_API_KEY not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const invoiceLabel = invoice.vendor
      ? `${invoice.vendor}${invoice.invoice_number ? " #" + invoice.invoice_number : ""}`
      : `מספר ${invoice.invoice_number ?? invoice_id.slice(0, 8)}`;

    const emailSubject = subject?.trim()
      ? subject.trim()
      : `[INBOT] חשבונית ${invoiceLabel} — בקשת הבהרה`;

    const emailHtml = `
      <div dir="rtl" style="font-family: 'Heebo', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e3a5f;">
        <div style="background: #1e3a5f; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0; font-weight: 700; font-size: 18px;">
          INBOT
        </div>
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
          <p style="margin: 0 0 12px; font-size: 15px;">שלום,</p>
          <p style="margin: 0 0 16px; font-size: 14px; color: #475569;">
            ${accountantName} מבקש הבהרה לגבי חשבונית במערכת INBOT:
          </p>
          <div style="background: #f8fafc; border-right: 4px solid #e8941a; padding: 16px; border-radius: 6px; margin: 16px 0;">
            <p style="margin: 0; font-size: 14px; white-space: pre-wrap;">${messageBody.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
          </div>
          <p style="margin: 16px 0 8px; font-size: 13px; color: #64748b;">
            חשבונית: <strong>${invoiceLabel}</strong>
          </p>
          <p style="margin: 16px 0; font-size: 13px; color: #475569;">
            ניתן להשיב ישירות למייל זה — תשובתך תגיע אוטומטית לרואה החשבון שלך.
          </p>
          <p style="margin: 24px 0 0; font-size: 13px; color: #64748b;">
            או להיכנס למערכת:
            <a href="https://app.inbot.app" style="color: #e8941a; text-decoration: none; font-weight: 600;">app.inbot.app</a>
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 12px;" />
          <p style="margin: 0; font-size: 11px; color: #94a3b8; text-align: center;">
            הודעה זו נשלחה דרך מערכת INBOT
          </p>
        </div>
      </div>
    `;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `INBOT <${fromEmail}>`,
        to: [clientEmail],
        subject: emailSubject,
        html: emailHtml,
      }),
    });

    if (!resendRes.ok) {
      const resendErr = await resendRes.text();
      console.error("Resend error:", resendErr);
      // החשבונית עודכנה והתגובה נשמרה — רק המייל נכשל
      return new Response(
        JSON.stringify({ success: true, email_sent: false, reason: "Resend error: " + resendErr }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, email_sent: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
