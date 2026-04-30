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

    const { accountant_id } = await req.json();
    if (!accountant_id) {
      return new Response(JSON.stringify({ error: "accountant_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // שליפת user_id של הרו"ח
    const { data: accountant } = await supabaseAdmin
      .from("accountants")
      .select("user_id")
      .eq("id", accountant_id)
      .single();

    // Soft-delete: סימון הרו"ח כמחוק במקום מחיקה פיזית
    const { error: softDeleteError } = await supabaseAdmin
      .from("accountants")
      .update({ deleted_at: new Date().toISOString(), updated_by: user.id })
      .eq("id", accountant_id);

    if (softDeleteError) {
      return new Response(JSON.stringify({ error: softDeleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // מחיקה קשה של user_roles, profiles ו-auth user (שומרים על accountant_clients להיסטוריה)
    if (accountant?.user_id) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", accountant.user_id);
      await supabaseAdmin.from("profiles").delete().eq("user_id", accountant.user_id);

      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(
        accountant.user_id
      );
      if (authDeleteError) {
        console.error("Failed to delete auth user:", authDeleteError.message);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
