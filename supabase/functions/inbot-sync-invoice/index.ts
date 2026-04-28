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
    telegram_chat_id,  // לחיפוש client_id
    sheet_row_id,      // שורה בגיליון
    invoice_date,      // row[0] — YYYY-MM-DD
    vendor,            // row[1]
    invoice_number,    // row[2]
    total,             // row[3]
    vat_original,      // row[4]
    vat_deductible,    // row[5]
    tax_deductible,    // row[6]
    category,          // row[7]
    drive_file_url,    // row[8]
    note_1,            // row[9]
    note_2,            // row[10]
    note_3,            // row[11]
    payment_date,      // row[12] — YYYY-MM-DD
    document_type,     // row[13]
    allocation_number, // row[14]
    currency_note,     // row[15]
    source,            // "gmail" | "telegram" | "manual"
    source_email,      // כתובת מייל מקור (Gmail path)
    original_filename, // שם קובץ מקורי
    gemini_confidence, // רמת ביטחון AI (0-1)
    intercept_type,    // "allocation"|"taxi"|"food"|"category"|"none"
  } = body;

  // חובה: telegram_chat_id
  if (!telegram_chat_id) {
    return new Response(JSON.stringify({ error: "telegram_chat_id required" }), { status: 400 });
  }

  // מצא client_id לפי telegram_chat_id
  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("id")
    .eq("telegram_chat_id", telegram_chat_id)
    .maybeSingle();

  // אם לקוח לא נמצא — שמור בטבלת quarantine לעיבוד מאוחר
  if (clientErr || !client) {
    const { error: qErr } = await supabase
      .from("invoice_quarantine")
      .insert({
        telegram_chat_id,
        payload: body,
        reason: clientErr?.message ?? "client_not_found",
      });
    return new Response(
      JSON.stringify({ 
        success: false, 
        queued: true,
        reason: "client_not_found — saved to quarantine" 
      }),
      { status: 202 }
    );
  }

  // כתוב חשבונית
  const { data: invoice, error: insertErr } = await supabase
    .from("invoices")
    .insert({
      client_id: client.id,
      sheet_row_id,
      invoice_date: invoice_date || null,
      vendor: vendor || null,
      invoice_number: invoice_number || null,
      total: total ?? null,
      vat_original: vat_original ?? null,
      vat_deductible: vat_deductible ?? null,
      tax_deductible: tax_deductible ?? null,
      category: category || null,
      drive_file_url: drive_file_url || null,
      note_1: note_1 || null,
      note_2: note_2 || null,
      note_3: note_3 || null,
      payment_date: payment_date || null,
      document_type: document_type || null,
      allocation_number: allocation_number || null,
      currency_note: currency_note || null,
      source: source || "telegram",
      source_email: source_email || null,
      original_filename: original_filename || null,
      gemini_confidence: gemini_confidence ?? null,
      intercept_type: intercept_type || null,
      status: "pending_review",
      received_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertErr) {
    return new Response(
      JSON.stringify({ success: false, error: insertErr.message }),
      { status: 500 }
    );
  }

  return new Response(
    JSON.stringify({ success: true, invoice_id: invoice.id }),
    { headers: { "Content-Type": "application/json" }, status: 200 }
  );
});
