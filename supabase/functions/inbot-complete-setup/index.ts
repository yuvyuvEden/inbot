import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // אבטחה — רק Gatekeeper יכול לקרוא
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${Deno.env.get("INBOT_SYNC_SECRET")}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const {
    client_uuid,       // UUID מ-Supabase — נשלח מ-Setup Wizard
    telegram_chat_id,  // Telegram ID של הלקוח
    sheet_id,          // Google Sheets ID
    script_id,         // Apps Script ID של הקונקטור
    drive_folder_id,   // Google Drive folder ID
    vat_number,        // ח.פ / ע.מ (אופציונלי)
    business_nature,   // טבע עסק (אופציונלי)
  } = body;

  // ולידציה
  if (!telegram_chat_id) {
    return new Response(
      JSON.stringify({ error: "telegram_chat_id required" }),
      { status: 400 }
    );
  }

  // אם יש client_uuid — עדכן לפיו (לקוח שנרשם דרך Web)
  // אם אין — חפש לפי telegram_chat_id (לקוח ישן / legacy)
  let query = supabase.from("clients").update({
    telegram_chat_id,
    ...(sheet_id && { sheet_id }),
    ...(script_id && { script_id }),
    ...(drive_folder_id && { drive_folder_id }),
    ...(vat_number && { vat_number }),
    ...(business_nature && { business_nature }),
    updated_at: new Date().toISOString(),
  });

  if (client_uuid) {
    query = query.eq("id", client_uuid);
  } else {
    query = query.eq("telegram_chat_id", telegram_chat_id);
  }

  const { data, error } = await query.select("id, brand_name, telegram_chat_id").single();

  if (error) {
    // אם לא נמצא לקוח עם client_uuid — נסה ליצור רשומה חדשה
    if (error.code === "PGRST116" && client_uuid) {
      return new Response(
        JSON.stringify({ error: "Client not found for UUID: " + client_uuid }),
        { status: 404 }
      );
    }
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500 }
    );
  }

  // בדוק אם יש חשבוניות בקורנטין ל-telegram_chat_id זה
  const { data: quarantined, error: qErr } = await supabase
    .from("invoice_quarantine")
    .select("id, payload")
    .eq("telegram_chat_id", telegram_chat_id)
    .is("resolved_at", null);

  let rescued = 0;

  // שחרר חשבוניות מהקורנטין
  if (quarantined && quarantined.length > 0) {
    for (const q of quarantined) {
      const payload = q.payload as any;
      const { error: insertErr } = await supabase.from("invoices").insert({
        client_id: data.id,
        sheet_row_id: payload.sheet_row_id ?? null,
        invoice_date: payload.invoice_date ?? null,
        vendor: payload.vendor ?? null,
        invoice_number: payload.invoice_number ?? null,
        total: payload.total ?? null,
        vat_original: payload.vat_original ?? null,
        vat_deductible: payload.vat_deductible ?? null,
        tax_deductible: payload.tax_deductible ?? null,
        category: payload.category ?? null,
        drive_file_url: payload.drive_file_url ?? null,
        note_1: payload.note_1 ?? null,
        note_2: payload.note_2 ?? null,
        note_3: payload.note_3 ?? null,
        payment_date: payload.payment_date ?? null,
        document_type: payload.document_type ?? null,
        allocation_number: payload.allocation_number ?? null,
        currency_note: payload.currency_note ?? null,
        source: payload.source ?? "telegram",
        source_email: payload.source_email ?? null,
        original_filename: payload.original_filename ?? null,
        gemini_confidence: payload.gemini_confidence ?? null,
        intercept_type: payload.intercept_type ?? null,
        status: "pending_review",
        received_at: new Date().toISOString(),
      });

      if (!insertErr) {
        // סמן כפתור
        await supabase
          .from("invoice_quarantine")
          .update({ resolved_at: new Date().toISOString() })
          .eq("id", q.id);
        rescued++;
      }
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      client_id: data.id,
      brand_name: data.brand_name,
      telegram_chat_id: data.telegram_chat_id,
      quarantine_rescued: rescued,
    }),
    { headers: { "Content-Type": "application/json" }, status: 200 }
  );
});
