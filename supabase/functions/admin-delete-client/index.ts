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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // בדיקת זהות — חייב להיות admin
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

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = (roles || []).some((r) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { client_id } = await req.json();
    if (!client_id) {
      return new Response(JSON.stringify({ error: "client_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // שליפת user_id של הלקוח לפני המחיקה
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("user_id")
      .eq("id", client_id)
      .single();

    // שליפת מזהי החשבוניות למחיקת התגובות
    const { data: invoiceRows } = await supabaseAdmin
      .from("invoices")
      .select("id")
      .eq("client_id", client_id);
    const invoiceIds = (invoiceRows || []).map((r) => r.id);

    if (invoiceIds.length > 0) {
      await supabaseAdmin.from("invoice_comments").delete().in("invoice_id", invoiceIds);
    }
    await supabaseAdmin.from("invoices").delete().eq("client_id", client_id);
    await supabaseAdmin.from("accountant_clients").delete().eq("client_id", client_id);
    await supabaseAdmin.from("notifications").delete().eq("client_id", client_id);
    await supabaseAdmin.from("usage_log").delete().eq("client_id", client_id);
    await supabaseAdmin.from("clients").delete().eq("id", client_id);

    // מחיקת user מ-auth + user_roles + profiles
    if (client?.user_id) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", client.user_id);
      await supabaseAdmin.from("profiles").delete().eq("user_id", client.user_id);
      await supabaseAdmin.auth.admin.deleteUser(client.user_id);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
