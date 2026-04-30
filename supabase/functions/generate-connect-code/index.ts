import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const BOT_USERNAME = Deno.env.get("TELEGRAM_BOT_USERNAME") ?? "INBOTbot";

function generateCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += ALLOWED_CHARS[Math.floor(Math.random() * ALLOWED_CHARS.length)];
  }
  return code;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
  if (userError || !user) return json({ error: "Unauthorized" }, 401);

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: client, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (clientError || !client) return json({ error: "Client not found" }, 404);

  let code = "";
  for (let attempts = 0; attempts < 5; attempts++) {
    const candidate = generateCode();
    const now = new Date().toISOString();
    const { data: existing } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("connect_code", candidate)
      .gt("connect_code_expires_at", now)
      .maybeSingle();
    if (!existing) { code = candidate; break; }
  }

  if (!code) return json({ error: "Failed to generate unique code" }, 500);

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error: updateError } = await supabaseAdmin
    .from("clients")
    .update({ connect_code: code, connect_code_expires_at: expiresAt })
    .eq("id", client.id);

  if (updateError) return json({ error: updateError.message }, 500);

  return json({
    code,
    expires_at: expiresAt,
    bot_url: `https://t.me/${BOT_USERNAME}?start=${code}`,
  });
});
