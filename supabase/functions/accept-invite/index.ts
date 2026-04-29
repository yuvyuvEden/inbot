import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const { invite_code } = await req.json();
    if (!invite_code?.trim()) return json({ error: "invite_code is required" }, 400);

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

    // מצא את הלקוח לפי הקוד — שלא פג תוקפו
    const now = new Date().toISOString();
    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id, brand_name, invite_code_expires_at")
      .eq("invite_code", invite_code.trim().toUpperCase())
      .gt("invite_code_expires_at", now)
      .maybeSingle();

    if (clientError || !client) {
      return json({ error: "קוד לא תקין או שפג תוקפו. בקש קוד חדש מבעל החשבון." }, 404);
    }

    // בדוק שהמשתמש לא כבר חבר בחשבון זה
    const { data: existing } = await supabaseAdmin
      .from("client_users")
      .select("id")
      .eq("client_id", client.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      return json({ error: "אתה כבר חבר בחשבון זה." }, 409);
    }

    // הוסף את המשתמש כ-member
    const { error: insertError } = await supabaseAdmin
      .from("client_users")
      .insert({
        client_id: client.id,
        user_id: user.id,
        role: "member",
      });

    if (insertError) return json({ error: insertError.message }, 500);

    // בטל את הקוד לאחר שימוש
    await supabaseAdmin
      .from("clients")
      .update({ invite_code: null, invite_code_expires_at: null })
      .eq("id", client.id);

    return json({ status: "ok", brand_name: client.brand_name });

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
