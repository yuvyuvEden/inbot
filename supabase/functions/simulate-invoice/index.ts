import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PROCESS_SECRET = Deno.env.get("INBOT_SYNC_SECRET") ?? "";
const PROCESS_URL   = `${SUPABASE_URL}/functions/v1/process-invoice`;

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

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) return json({ error: "Forbidden — admins only" }, 403);

    const { client_id, file_bytes_b64, mime_type } = await req.json();
    if (!client_id || !file_bytes_b64) {
      return json({ error: "client_id and file_bytes_b64 are required" }, 400);
    }

    const res = await fetch(PROCESS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${PROCESS_SECRET}`,
      },
      body: JSON.stringify({
        chat_id: "simulator",
        client_id,
        source: "simulator",
        file_bytes_b64,
        mime_type: mime_type ?? "application/pdf",
        skip_classify: true,
        skip_intercepts: true,
      }),
    });

    const data = await res.json();
    return json(data);

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
