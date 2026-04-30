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

    const { name, email, phone, vat_number, plan_type, price_per_client, monthly_fee } = await req.json();

    if (!name || !email) {
      return new Response(JSON.stringify({ error: "name and email are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name: name,
        role: "accountant",
      },
    });

    if (createError || !newUser.user) {
      return new Response(JSON.stringify({ error: createError?.message || "Failed to create user" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newUserId = newUser.user.id;

    const { data: accountant, error: accError } = await supabaseAdmin
      .from("accountants")
      .insert({
        user_id: newUserId,
        name,
        email,
        phone: phone || null,
        vat_number: vat_number || null,
        plan_type: plan_type || "accountant_monthly",
        price_per_client: price_per_client || 0,
        monthly_fee: monthly_fee || 0,
        is_active: true,
        auto_renew: true,
      })
      .select()
      .single();

    if (accError) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return new Response(JSON.stringify({ error: accError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: deleteRoleError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", newUserId)
      .eq("role", "client");

    if (deleteRoleError) {
      console.error("Failed to delete client role:", deleteRoleError.message);
    }

    const { error: insertRoleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: "accountant" });

    if (insertRoleError) {
      console.error("Failed to insert accountant role:", insertRoleError.message);
    }

    const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo: `https://app.inbot.co.il/accountant`,
      },
    });

    if (resetError) {
      console.error("Failed to send invite email:", resetError.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: newUserId,
        accountant_id: accountant.id,
      }),
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
