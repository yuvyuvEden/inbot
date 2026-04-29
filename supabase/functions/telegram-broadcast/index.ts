import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN  = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    // וודא שהמשתמש הוא אדמין
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) return json({ error: "Forbidden — admins only" }, 403);

    const { message } = await req.json();
    if (!message?.trim()) return json({ error: "message is required" }, 400);

    // שלוף כל הלקוחות הפעילים עם telegram_chat_id
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from("clients")
      .select("id, brand_name, telegram_chat_id")
      .eq("is_active", true)
      .not("telegram_chat_id", "is", null);

    if (clientsError) return json({ error: clientsError.message }, 500);
    if (!clients?.length) return json({ status: "ok", sent: 0, failed: 0, skipped: 0 });

    let sent = 0, failed = 0;

    // שלח בקצב — 30 הודעות בשנייה מקסימום (Telegram limit)
    for (const client of clients) {
      try {
        const res = await fetch(
          `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: client.telegram_chat_id,
              text: message,
              parse_mode: "HTML",
            }),
          }
        );
        if (res.ok) {
          sent++;
        } else {
          const err = await res.json();
          console.warn(`Failed to send to ${client.brand_name}: ${err.description}`);
          failed++;
        }
      } catch (e) {
        console.error(`Error sending to ${client.brand_name}:`, e);
        failed++;
      }
      // המתן 35ms בין הודעות — מתחת ל-30/שנייה
      await new Promise(r => setTimeout(r, 35));
    }

    return json({ status: "ok", sent, failed, total: clients.length });

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
