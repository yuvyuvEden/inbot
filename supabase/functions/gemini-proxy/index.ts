import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // שלוף נתוני לקוח + הגדרות מערכת במקביל
    const [clientRes, settingsRes] = await Promise.all([
      supabaseAdmin
        .from("clients")
        .select("gemini_api_key, brand_name, business_nature, vat_rate")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle(),
      supabaseAdmin
        .from("system_settings")
        .select("key, value")
        .in("key", ["vat_rules", "income_tax_rules"])
    ]);

    if (clientRes.error || !clientRes.data?.gemini_api_key) {
      return json({ error: "Gemini key not configured" }, 400);
    }

    const client = clientRes.data;
    const settings: Record<string, unknown> = {};
    for (const row of settingsRes.data || []) {
      settings[row.key] = row.value;
    }

    const vatRules = settings["vat_rules"] || {};
    const incomeTaxRules = settings["income_tax_rules"] || {};
    const vatRatePercent = Math.round((client.vat_rate ?? 1.18) * 100);

    // בנה כללי מע"מ כטקסט קריא
    const vatRulesText = Object.entries(vatRules as Record<string, number>)
      .map(([cat, rate]) => `${cat}: ${Math.round(rate * 100)}%`)
      .join(", ");

    const taxRulesText = Object.entries(incomeTaxRules as Record<string, number>)
      .map(([cat, rate]) => `${cat}: ${Math.round(rate * 100)}%`)
      .join(", ");

    const { question, history } = await req.json();
    if (!question) return json({ error: "question is required" }, 400);

    // בנה system prompt עשיר בצד השרת — כמו 335.gs
    const systemPrompt = `אתה יועץ פיננסי וחשבונאי מומחה לעצמאים ישראלים. אתה מנתח נתוני הוצאות עסקיות ועוזר לחסוך כסף ולמטב את ניהול המס.

## זהות העסק
שם: ${client.brand_name || "עסק"}
${client.business_nature ? `אופי העסק: ${client.business_nature}` : ""}
שיעור מע"מ נוכחי: ${vatRatePercent}%

## כללי מע"מ מוכר לפי קטגוריה
${vatRulesText || "לא הוגדרו"}

## כללי הוצאה מוכרת (מס הכנסה) לפי קטגוריה
${taxRulesText || "לא הוגדרו"}

## הוראות
- ענה בעברית, קצר וממוקד — 2-4 משפטים מקסימום אלא אם נדרש פירוט
- השתמש במספרים מדויקים מהנתונים בלבד — אל תמציא
- השתמש ב-₪ לסכומים עם פסיק אלפים
- אם אין נתון — אמור "לא מצאתי בנתונים"
- קריטי: אל תדפיס תהליך חשיבה. החזר אך ורק את התשובה הסופית בעברית.`;

    // בנה contents עם היסטוריה
    const safeHistory = Array.isArray(history) ? history.slice(-10) : [];
    const contents = [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "הבנתי. אני מוכן לנתח את הנתונים ולענות על שאלותיך." }] },
      ...safeHistory.map((m: { role: string; text: string }) => ({
        role: m.role === "bot" ? "model" : "user",
        parts: [{ text: m.text }],
      })),
      { role: "user", parts: [{ text: question }] },
    ];

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${client.gemini_api_key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: { temperature: 0.3, maxOutputTokens: 1500 },
        }),
      }
    );

    if (!geminiRes.ok) {
      return json({ error: await geminiRes.text() }, geminiRes.status);
    }

    const geminiData = await geminiRes.json();
    // FIX_THINKING — מסנן thought parts
    const parts = geminiData?.candidates?.[0]?.content?.parts || [];
    const text = parts.find((p: { text?: string; thought?: boolean }) => p.text && !p.thought)?.text ?? "";

    return json({ text });

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
