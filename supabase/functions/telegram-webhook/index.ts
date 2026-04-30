import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN      = Deno.env.get("TELEGRAM_BOT_TOKEN")  ?? "";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET")       ?? "";
const PROCESS_URL    = Deno.env.get("PROCESS_INVOICE_URL")  ?? "";
const PROCESS_SECRET = Deno.env.get("INBOT_SYNC_SECRET")    ?? "";
const APP_URL        = Deno.env.get("APP_URL") ?? "https://app.inbot.co.il";

const RATE_LIMIT_MAX      = 10;
const RATE_LIMIT_WINDOW_S = 60;

Deno.serve(async (req) => {
  const incomingSecret = req.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
  if (!WEBHOOK_SECRET || incomingSecret !== WEBHOOK_SECRET) {
    console.warn("webhook secret mismatch — ignoring");
    return ok();
  }

  let update: any;
  try { update = await req.json(); } catch { return ok(); }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const msg      = update?.message;
  const callback = update?.callback_query;

  if (callback) {
    await answerCallback(callback.id);
    await handleCallback(supabase, callback);
    return ok();
  }
  if (!msg) return ok();

  const chatId  = String(msg.chat?.id ?? "");
  const text    = (msg.text ?? "").trim();
  const isGroup = msg.chat?.type !== "private";

  if (isGroup && !text.startsWith("/")) return ok();

  const limited = await checkRateLimit(supabase, chatId);
  if (limited) { console.warn(`rate limit exceeded for chatId=${chatId}`); return ok(); }

  if (text.toLowerCase().startsWith("/start")) {
    await handleStart(supabase, chatId, text); return ok();
  }
  if (text.toLowerCase().startsWith("/connect")) {
    await handleConnect(supabase, chatId, text); return ok();
  }
  if (text.toLowerCase() === "/status") {
    await handleStatus(supabase, chatId); return ok();
  }

  if (msg.photo || msg.document) {
    const client = await findClientByChatId(supabase, chatId);
    if (!client) {
      await sendMessage(chatId, `⛔ לא נמצא חשבון מחובר.\n\nלהרשמה: ${APP_URL}`);
      return ok();
    }
    if (!client.is_active) {
      await sendMessage(chatId, "⛔ החשבון שלך אינו פעיל. לפרטים: " + APP_URL);
      return ok();
    }
    fireAndForget(PROCESS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${PROCESS_SECRET}` },
      body: JSON.stringify({ chat_id: chatId, client_id: client.id, message: msg, source: "telegram" }),
    });
    await sendMessage(chatId, "📂 מעבד את המסמך...");
    return ok();
  }

  if (text && !text.startsWith("/")) {
    const client = await findClientByChatId(supabase, chatId);
    if (client) {
      await sendMessage(chatId, "שלח חשבונית לעיבוד (תמונה או PDF), או /status לבדיקת מנוי.");
    } else {
      await sendMessage(chatId, `👋 שלום!\n\nכדי להתחיל שלח /start, או הירשם ב:\n${APP_URL}`);
    }
  }

  return ok();
});

async function handleStart(supabase: any, chatId: string, text: string) {
  const parts = text.trim().split(/\s+/);
  const payload = parts[1] ?? "";

  // אם ה-payload הוא קוד חיבור בן 6 תווים — הפעל handleConnect
  if (/^[A-Z0-9]{6}$/i.test(payload)) {
    await handleConnect(supabase, chatId, `/connect ${payload}`);
    return;
  }

  const existing = await findClientByChatId(supabase, chatId);
  if (existing) {
    await sendMessage(chatId, `✅ אתה כבר מחובר!\n\nלדשבורד: ${APP_URL}\n\nשלח חשבונית לעיבוד, או /status לבדיקת מנוי.`);
    return;
  }

  await sendMessage(chatId, `👋 ברוך הבא ל-INBOT!\n\nאוטומציה חכמה לאיסוף חשבוניות עסקיות 🧾\n\nלהרשמה ולחיבור החשבון:\n${APP_URL}\n\nאחרי ההרשמה תקבל קישור חיבור מהדשבורד.`);
}

async function handleConnect(supabase: any, chatId: string, text: string) {
  const parts = text.trim().split(/\s+/);
  const code  = (parts[1] ?? "").trim().toUpperCase();

  if (!code || code.length !== 6 || !/^[A-Z0-9]{6}$/.test(code)) {
    await sendMessage(chatId, "❌ קוד לא תקין.\n\nהשתמש בקישור שנשלח אליך, או חזור לדשבורד וצור קוד חדש.");
    return;
  }

  // בדוק אם chat_id כבר מחובר לאותו חשבון — התעלם בשקט
  const { data: existingLink } = await supabase
    .from("client_telegram_users")
    .select("id, client_id")
    .eq("chat_id", chatId)
    .eq("is_active", true)
    .maybeSingle();

  const now = new Date().toISOString();
  const { data: client, error } = await supabase
    .from("clients")
    .select("id, brand_name, connect_code, connect_code_expires_at, telegram_chat_id, plan_id, plans(user_limit)")
    .eq("connect_code", code)
    .gt("connect_code_expires_at", now)
    .maybeSingle();

  if (error || !client) {
    await sendMessage(chatId, "❌ הקוד לא נמצא או פג תוקפו.\n\nחזור לדשבורד וצור קוד חדש.");
    return;
  }

  // אם כבר מחובר לאותו client — התעלם בשקט
  if (existingLink && existingLink.client_id === client.id) {
    await sendMessage(chatId,
      `✅ <b>כבר מחובר!</b>\n\nחשבון: ${escHtml(client.brand_name)}\n\nשלח חשבונית לעיבוד, או /status לבדיקת מנוי.`,
      "HTML"
    );
    return;
  }

  // בדיקת מגבלת משתמשים לפי חבילה
  const userLimit: number = client.plans?.user_limit ?? 0;
  if (userLimit > 0) {
    const { count } = await supabase
      .from("client_telegram_users")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .eq("is_active", true);

    if ((count ?? 0) >= userLimit) {
      await sendMessage(chatId,
        `⛔ הגעת למגבלת המשתמשים של החבילה (${userLimit}).\n\nפנה לבעל החשבון לשדרוג החבילה.`
      );
      return;
    }
  }

  // הוסף ל-client_telegram_users
  const { error: insertErr } = await supabase
    .from("client_telegram_users")
    .insert({ client_id: client.id, chat_id: chatId, is_active: true });

  if (insertErr && insertErr.code !== "23505") {
    // 23505 = unique violation — כבר קיים, לא שגיאה אמיתית
    console.error("insert client_telegram_users failed:", insertErr.message);
    await sendMessage(chatId, "❌ שגיאה בחיבור. נסה שוב או פנה לתמיכה.");
    return;
  }

  // dual-write: אם זה ה-chat_id הראשון — כתוב גם ל-clients.telegram_chat_id
  if (!client.telegram_chat_id) {
    const setupUrl = Deno.env.get("SUPABASE_URL") + "/functions/v1/inbot-complete-setup";
    await fetch(setupUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("INBOT_SYNC_SECRET")}`,
      },
      body: JSON.stringify({ client_uuid: client.id, telegram_chat_id: chatId }),
    });
  }

  // הקוד נשאר תקף — לא מוחקים אותו
  await sendMessage(chatId,
    `✅ <b>החיבור הצליח!</b>\n\nחשבון: ${escHtml(client.brand_name)}\n\nשלח חשבונית לעיבוד, או /status לבדיקת מנוי.`,
    "HTML"
  );
}

async function handleStatus(supabase: any, chatId: string) {
  const client = await findClientByChatId(supabase, chatId);
  if (!client) {
    await sendMessage(chatId, `⛔ לא נמצא חשבון מחובר.\n\nלהרשמה: ${APP_URL}`);
    return;
  }

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("client_id", client.id)
    .gte("created_at", startOfMonth.toISOString());

  const expiry = client.plan_expires_at
    ? new Date(client.plan_expires_at).toLocaleDateString("he-IL")
    : "ללא הגבלה";

  const planLabels: Record<string, string> = {
    trial: "ניסיון חינם", basic: "בסיסי", pro: "פרו", managed: "מנוהל ע\"י רו\"ח",
  };
  const planLabel = planLabels[client.plan_type] ?? client.plan_type ?? "—";

  await sendMessage(chatId,
    `📊 <b>סטטוס INBOT</b>\n\nעסק: ${escHtml(client.brand_name)}\nחבילה: ${planLabel}\nתוקף: ${expiry}\nחשבוניות החודש: ${count ?? 0}`,
    "HTML"
  );
}

async function checkRateLimit(supabase: any, chatId: string): Promise<boolean> {
  const now    = new Date();
  const nowIso = now.toISOString();

  const { data, error } = await supabase
    .from("telegram_rate_limits")
    .select("message_count, window_start")
    .eq("chat_id", chatId)
    .maybeSingle();

  if (error) { console.warn("rate limit DB error:", error.message); return false; }

  if (!data) {
    await supabase.from("telegram_rate_limits").insert({
      chat_id: chatId, message_count: 1, window_start: nowIso, updated_at: nowIso,
    });
    return false;
  }

  const secondsElapsed = (now.getTime() - new Date(data.window_start).getTime()) / 1000;

  if (secondsElapsed > RATE_LIMIT_WINDOW_S) {
    await supabase.from("telegram_rate_limits")
      .update({ message_count: 1, window_start: nowIso, updated_at: nowIso })
      .eq("chat_id", chatId);
    return false;
  }

  if (data.message_count >= RATE_LIMIT_MAX) return true;

  await supabase.from("telegram_rate_limits")
    .update({ message_count: data.message_count + 1, updated_at: nowIso })
    .eq("chat_id", chatId);
  return false;
}

async function findClientByChatId(supabase: any, chatId: string) {
  const { data } = await supabase
    .from("clients")
    .select("id, brand_name, plan_type, plan_expires_at, is_active, telegram_chat_id")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();
  return data ?? null;
}

async function sendMessage(chatId: string, text: string, parseMode?: string) {
  if (!BOT_TOKEN) return;
  const body: any = { chat_id: chatId, text };
  if (parseMode) body.parse_mode = parseMode;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function answerCallback(callbackId: string) {
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackId }),
  });
}

function fireAndForget(url: string, init: RequestInit) {
  try {
    (globalThis as any).EdgeRuntime?.waitUntil?.(fetch(url, init));
  } catch {
    fetch(url, init).catch(() => {});
  }
}

async function handleCallback(supabase: any, callback: any) {
  const chatId = String(callback.message?.chat?.id ?? "");
  const data   = callback.data ?? "";

  const parts    = data.split("_");
  if (parts.length < 3) return;
  const flowType = parts[0];
  const uid      = parts[1];
  const action   = parts.slice(2).join("_");

  const { data: flow, error } = await supabase
    .from("invoice_flows")
    .select("*")
    .eq("id", uid)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !flow) {
    await sendMessage(chatId, "⚠️ הפעולה פגה. שלח את החשבונית שוב.");
    return;
  }

  await supabase.from("invoice_flows").delete().eq("id", uid);

  const inv       = flow.invoice_data;
  const clientId  = flow.client_id;
  const PROCESS_URL_LOCAL    = Deno.env.get("PROCESS_INVOICE_URL") ?? "";
  const PROCESS_SECRET_LOCAL = Deno.env.get("INBOT_SYNC_SECRET")   ?? "";

  if (flowType === "alloc") {
    if (action === "delete") {
      await sendMessage(chatId, "🗑️ החשבונית בוטלה.");
      return;
    }
    if (action === "keep") {
      inv.force_zero_vat = true;
      inv.allocation_number = "WAIVED";
    }
  } else if (flowType === "taxi") {
    if (action === "no") {
      await sendMessage(chatId, "🗑️ הנסיעה לא נרשמה (פרטית).");
      return;
    }
  } else if (flowType === "food") {
    const categoryMap: Record<string, string> = {
      office:    "כיבוד למשרד",
      meals:     "ארוחות ומסעדות",
      groceries: "ארוחות ומסעדות",
    };
    inv.category = categoryMap[action] ?? inv.category;
  } else if (flowType === "dup") {
    if (action === "delete") {
      await sendMessage(chatId, "🗑️ החשבונית בוטלה (כפילות).");
      return;
    }
  }

  await fetch(PROCESS_URL_LOCAL, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${PROCESS_SECRET_LOCAL}`,
    },
    body: JSON.stringify({
      chat_id:        chatId,
      client_id:      clientId,
      source:         "telegram",
      file_bytes_b64: null,
      message:        null,
      resolved_flow:  inv,
      skip_classify:  true,
      skip_intercepts: true,
    }),
  });
}

function ok(): Response { return new Response("OK", { status: 200 }); }

function isValidUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function escHtml(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
