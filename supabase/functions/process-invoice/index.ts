import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PROCESS_SECRET = Deno.env.get("INBOT_SYNC_SECRET") ?? "";
const BOT_TOKEN      = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const auth = req.headers.get("Authorization") ?? "";
  if (!PROCESS_SECRET || auth !== `Bearer ${PROCESS_SECRET}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: any;
  try { body = await req.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const { chat_id, client_id, message, source = "telegram",
          file_bytes_b64, mime_type, email_date, msg_from,
          email_subject, skip_classify = false,
          resolved_flow, skip_intercepts = false } = body;

  if (!chat_id || !client_id) {
    return json({ error: "chat_id and client_id required" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const [clientRes, settingsRes] = await Promise.all([
    supabase.from("clients").select(`
      id, brand_name, vat_number, business_nature, custom_categories,
      owner_aliases, tax_rules, gemini_api_key, ai_temperature,
      alloc_threshold_before, alloc_threshold_after, lookback_rows, max_distance
    `).eq("id", client_id).eq("is_active", true).single(),
    supabase.from("system_settings").select("key, value"),
  ]);

  if (clientRes.error || !clientRes.data) {
    await sendMessage(chat_id, "⛔ שגיאה פנימית — לא נמצא לקוח.");
    return json({ error: "Client not found" }, 404);
  }

  const client = clientRes.data;
  const G = parseGlobalSettings(settingsRes.data ?? []);

  const allCategoryNames = [
    ...G.categories,
    ...(Array.isArray(client.custom_categories)
      ? client.custom_categories.map((c: any) => typeof c === "object" ? c.name : c)
      : []),
  ];

  // Short-circuit: resolved flow from telegram callback — write directly
  if (resolved_flow && skip_intercepts) {
    await writeInvoice(supabase, client_id, chat_id, resolved_flow, source,
      G, client, allCategoryNames);
    return json({ status: "ok", resolved: true });
  }

  const geminiKey = client.gemini_api_key ?? "";
  if (!geminiKey) {
    await sendMessage(chat_id, "⚠️ מפתח Gemini לא מוגדר.\n\nהגדר אותו בהגדרות הדשבורד.");
    return json({ error: "Gemini key missing" }, 422);
  }

  let rawBytes: number[];
  let mimeType: string;
  let originalName: string;

  try {
    if (file_bytes_b64) {
      rawBytes     = Array.from(atob(file_bytes_b64), c => c.charCodeAt(0));
      mimeType     = mime_type ?? "application/pdf";
      originalName = "invoice.pdf";
    } else if (message?.document) {
      const fileId  = message.document.file_id;
      const fileRes = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`
      );
      const fileData = await fileRes.json();
      const filePath = fileData.result?.file_path;
      if (!filePath) throw new Error("Cannot get file path from Telegram");
      const dlRes  = await fetch(
        `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`
      );
      const blob   = await dlRes.arrayBuffer();
      rawBytes     = Array.from(new Uint8Array(blob));
      mimeType     = message.document.mime_type ?? "application/pdf";
      originalName = message.document.file_name ?? "invoice.pdf";
    } else if (message?.photo) {
      const photo   = message.photo[message.photo.length - 1];
      const fileRes = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${photo.file_id}`
      );
      const fileData = await fileRes.json();
      const filePath = fileData.result?.file_path;
      if (!filePath) throw new Error("Cannot get photo path from Telegram");
      const dlRes  = await fetch(
        `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`
      );
      const blob   = await dlRes.arrayBuffer();
      rawBytes     = Array.from(new Uint8Array(blob));
      mimeType     = "image/jpeg";
      originalName = "invoice.jpg";
    } else {
      await sendMessage(chat_id, "⚠️ לא נמצא קובץ בהודעה.");
      return json({ error: "No file in message" }, 400);
    }
  } catch (e: any) {
    await sendMessage(chat_id, "❌ שגיאה בהורדת הקובץ. נסה שוב.");
    return json({ error: e.message }, 500);
  }

  if (mimeType === "application/pdf" || originalName.endsWith(".pdf")) {
    const header = String.fromCharCode(rawBytes[0], rawBytes[1], rawBytes[2], rawBytes[3]);
    if (!header.startsWith("%PDF")) {
      console.log(`PDF מזויף — ${originalName}`);
      return json({ status: "skip", reason: "fake_pdf" });
    }
    mimeType = "application/pdf";
  }

  const base64 = btoa(String.fromCharCode(...rawBytes));

  if (source === "gmail" && !skip_classify) {
    const docClass = await classifyDocumentType(base64, mimeType, geminiKey, G.prompt_classify_document);
    if (docClass === "OTHER" || docClass === "REPORT") {
      console.log(`סיווג מקדים: ${docClass} — דילוג`);
      return json({ status: "skip", reason: docClass });
    }
  }

  const myNames = getOwnerNames(client);
  const allCategories = [
    ...G.categories,
    ...(Array.isArray(client.custom_categories)
      ? client.custom_categories.map((c: any) =>
          typeof c === "object" && c.description ? `${c.name} (${c.description})` : (c.name ?? c)
        )
      : []),
  ];

  const aiResults = await analyzeInvoice({
    base64, mimeType, geminiKey,
    myNames, myHp: client.vat_number ?? "",
    businessNature: client.business_nature ?? "",
    allCategories,
    emailDate: email_date ?? null,
    msgFrom: msg_from ?? null,
    invoicePlatforms: G.invoice_platforms,
    aiTemperature: client.ai_temperature ?? G.ai_temperature,
    aiPromptOverride: G.prompt_analyze_invoice ?? null,
  });

  if (!aiResults) {
    await sendMessage(chat_id, "⚠️ לא הצלחתי לנתח את המסמך.\n\nנסה שוב או רשום ידנית בדשבורד.");
    await supabase.from("ai_processing_errors").insert({
      client_id:  client_id,
      source,
      error_type: "ai_null",
      error_msg:  "כל 3 ניסיונות Gemini נכשלו — לא הוחזר JSON תקין",
      file_name:  originalName ?? null,
    }).catch(() => {});
    return json({ status: "failed", reason: "ai_null" });
  }

  if (!Array.isArray(aiResults)) {
    if (["INCOME","NON_FINANCIAL","LINK_ONLY_INVOICE","חשבונית עסקה"].includes(aiResults.document_type)) {
      if (aiResults.document_type === "INCOME") {
        await broadcastMessage(supabase, client_id, chat_id, `⚠️ <b>זוהתה הכנסה — לא נרשמה</b>`, "HTML");
      }
      return json({ status: "skip", reason: aiResults.document_type });
    }
  }

  const results = Array.isArray(aiResults) ? aiResults : [aiResults];
  const expenses = results.filter(r =>
    r && !["NON_FINANCIAL","LINK_ONLY_INVOICE","חשבונית עסקה","INCOME"].includes(r.document_type)
  );

  if (expenses.length === 0) {
    return json({ status: "skip", reason: "no_expenses" });
  }

  for (const aiData of expenses) {
    if (aiData.total === 0 && !aiData.is_credit) continue;

    if (!verifyOwnership(aiData.billed_to ?? "", myNames, client.vat_number ?? "",
        client.max_distance ?? G.max_distance)) {
      if (source === "gmail") {
        await broadcastMessage(supabase, client_id, chat_id,
          `⚠️ <b>חשבונית נדחתה — לא שייכת לעסק</b>\nלכבוד: ${escHtml(aiData.billed_to)}\nספק: ${escHtml(aiData.vendor)}`,
          "HTML"
        );
      }
      await supabase.from("ai_processing_errors").insert({
        client_id:  client_id,
        source,
        error_type: "ownership_rejected",
        error_msg:  `לכבוד: "${aiData.billed_to}" — לא תואם לבעלים`,
        vendor:     aiData.vendor ?? null,
        file_name:  originalName ?? null,
      }).catch(() => {});
      continue;
    }

    const currency = (aiData.currency ?? "ILS").toUpperCase().trim();
    if (!["ILS","NIS"].includes(currency)) {
      const rate = await getFxRate(currency);
      if (rate && rate !== 1.0) {
        const orig = aiData.total;
        aiData.fx_note = `שולם ${orig} ${currency} (שער ${rate})`;
        aiData.total   = Math.round(orig * rate * 100) / 100;
        aiData.vat     = 0;
        aiData.is_receipt_only = true;
      }
    }

    if (aiData.supplier_tax_status === "EXEMPT" && !aiData.is_credit) {
      aiData.vat = 0;
      aiData.is_receipt_only = true;
      aiData.fx_note = 'עוסק פטור/זעיר — ללא מע"מ';
    }

    const dupResult = await checkDuplicateSmart(supabase, client_id, {
      invoiceNumber: aiData.invoice_number,
      vendor:        aiData.vendor,
      total:         Math.abs(sanitizeNumber(aiData.total)),
      invoiceDate:   aiData.invoice_date,
      lookbackRows:  client.lookback_rows ?? G.duplicate_lookback_rows,
    });

    if (dupResult.isExact) {
      if (source === "telegram") {
        await broadcastMessage(supabase, client_id, chat_id,
          `⛔ <b>כפילות!</b>\nחשבונית ${escHtml(aiData.invoice_number)} כבר קיימת.`, "HTML"
        );
      }
      continue;
    }

    if (dupResult.isSuspected) {
      const uid = makeUid();
      await saveFlow(supabase, uid, client_id, chat_id, "duplicate", aiData, "");
      await broadcastMessage(supabase, client_id, chat_id,
        `🤔 <b>ייתכן כפילות</b>\nספק: ${escHtml(aiData.vendor)} | ${Math.abs(aiData.total)}₪\nספק קיים: ${escHtml(dupResult.existingVendor ?? "")}`,
        "HTML",
        { inline_keyboard: [
          [{ text: "🗑️ מחק (כפילות)", callback_data: `dup_${uid}_delete` }],
          [{ text: "📝 רשום למרות זאת", callback_data: `dup_${uid}_keep` }],
        ]}
      );
      continue;
    }

    const allocThreshold = getAllocThreshold(client, G);
    const invoiceDate    = aiData.invoice_date ?? "";
    const needsAlloc     = requiresAllocationNumber(aiData, invoiceDate, allocThreshold);

    if (needsAlloc && !aiData.allocation_number) {
      const uid = makeUid();
      await saveFlow(supabase, uid, client_id, chat_id, "allocation", aiData, "");
      await broadcastMessage(supabase, client_id, chat_id,
        `⚠️ <b>חסר מספר הקצאה!</b>\n${escHtml(aiData.vendor)} | ${Math.abs(aiData.total)}₪\nצור קשר עם הספק.\n\nלקבל בכל זאת (ללא קיזוז מע"מ)?`,
        "HTML",
        { inline_keyboard: [
          [{ text: "❌ לא, אבקש חשבונית חדשה", callback_data: `alloc_${uid}_delete` }],
          [{ text: "✅ כן, קבל (0 מע\"מ)",     callback_data: `alloc_${uid}_keep`   }],
        ]}
      );
      continue;
    }

    if (isTaxi(aiData.category)) {
      const uid = makeUid();
      await saveFlow(supabase, uid, client_id, chat_id, "taxi", aiData, "");
      await broadcastMessage(supabase, client_id, chat_id,
        `🚕 <b>${escHtml(aiData.vendor)}</b> | ${Math.abs(aiData.total)}₪\nהנסיעה היתה לצרכי עבודה?`,
        "HTML",
        { inline_keyboard: [
          [{ text: "✅ כן — עסקי (מוכר)", callback_data: `taxi_${uid}_yes` }],
          [{ text: "❌ לא — פרטי",        callback_data: `taxi_${uid}_no`  }],
        ]}
      );
      continue;
    }

    if (isFood(aiData.vendor, G.food_vendors_regex)) {
      const uid = makeUid();
      await saveFlow(supabase, uid, client_id, chat_id, "food", aiData, "");
      await broadcastMessage(supabase, client_id, chat_id,
        `🍽️ <b>${escHtml(aiData.vendor)}</b> | ${Math.abs(aiData.total)}₪\nסוג הרכישה?`,
        "HTML",
        { inline_keyboard: [
          [{ text: "☕ כיבוד למשרד",       callback_data: `food_${uid}_office`    }],
          [{ text: "🍽️ ארוחות ומסעדות",   callback_data: `food_${uid}_meals`     }],
          [{ text: "🛒 קניות (ללא מע\"מ)", callback_data: `food_${uid}_groceries` }],
        ]}
      );
      continue;
    }

    await writeInvoice(supabase, client_id, chat_id, aiData, source,
      G, client, allCategoryNames);
  }

  return json({ status: "ok" });
});

async function writeInvoice(
  supabase: any, clientId: string, chatId: string,
  aiData: any, source: string, G: any, client: any, allCategoryNames: string[]
) {
  const mult       = aiData.is_credit ? -1 : 1;
  const finalTotal = Math.abs(sanitizeNumber(aiData.total)) * mult;
  const vatRate    = 1 + (G.vat_rate_percent ?? 18) / 100;

  let rawVat = aiData.is_receipt_only ? 0 : sanitizeNumber(aiData.vat);
  if (!rawVat && aiData.total > 0 && !aiData.is_receipt_only &&
      !G.no_vat_categories.includes(aiData.category)) {
    rawVat = aiData.total - (aiData.total / vatRate);
  }
  if (aiData.force_zero_vat) rawVat = 0;

  const vatOriginal  = Math.round(rawVat * mult * 100) / 100;

  const taxRules    = client.tax_rules ?? {};
  const vatRules    = G.vat_rules   ?? {};
  const incomeRules = G.income_tax_rules ?? {};
  const vRate       = aiData.force_zero_vat ? 0 : (taxRules[aiData.category]?.vat  ?? vatRules[aiData.category]  ?? 1.0);
  const tRate       = taxRules[aiData.category]?.tax  ?? incomeRules[aiData.category] ?? 1.0;

  const vatRecognized  = Math.round(rawVat * vRate * mult * 100) / 100;
  const netAmount      = Math.round((Math.abs(aiData.total) - rawVat) * mult * 100) / 100;
  const taxDeductible  = Math.round(netAmount * tRate * 100) / 100;

  const category = allCategoryNames.includes(aiData.category) ? aiData.category : "אחר";

  const { error } = await supabase.from("invoices").insert({
    client_id:        clientId,
    invoice_date:     normalizeDate(aiData.invoice_date)  || null,
    vendor:           aiData.vendor                       || null,
    invoice_number:   String(aiData.invoice_number || "").replace(/^'/, "") || null,
    total:            finalTotal,
    vat_original:     vatOriginal,
    vat_deductible:   vatRecognized,
    tax_deductible:   taxDeductible,
    category,
    document_type:    aiData.document_type                || null,
    payment_date:     normalizeDate(aiData.payment_date)  || null,
    allocation_number: aiData.allocation_number           || null,
    currency_note:    aiData.fx_note                      || null,
    source,
    status:           "pending_review",
    received_at:      new Date().toISOString(),
    gemini_confidence: aiData.gemini_confidence           ?? null,
    intercept_type:   null,
  }).select("id").single();

  if (error) {
    console.error("writeInvoice error:", error.message);
    await sendMessage(chatId, "❌ שגיאה בשמירת החשבונית. נסה שוב.");
    await supabase.from("ai_processing_errors").insert({
      client_id:  clientId,
      source,
      error_type: "write_failed",
      error_msg:  error.message,
      vendor:     aiData.vendor ?? null,
    }).catch(() => {});
    return;
  }

  if (source === "telegram" || source === "gmail") {
    await broadcastMessage(supabase, clientId, chatId,
      `✅ <b>נרשם בהצלחה:</b>\nספק: ${escHtml(aiData.vendor)}\nסכום: ${Math.abs(finalTotal)}₪\nקטגוריה: ${escHtml(category)}${aiData.fx_note ? `\n💱 ${escHtml(aiData.fx_note)}` : ""}`,
      "HTML"
    );
  }
}

async function classifyDocumentType(
  base64: string, mimeType: string, geminiKey: string, promptOverride?: string | null
): Promise<string> {
  const prompt = promptOverride ?? `You are a document classifier. Look ONLY at the document content and answer with ONE word only:
- "INVOICE" if the document explicitly contains: חשבונית מס, קבלה, חשבונית מס קבלה, חשבונית זיכוי, tax invoice, invoice, receipt AND has a total amount due or VAT amount.
- "REPORT" if this is a summary report with NO amount due — ledger, account statement, profit/loss report.
- "OTHER" if anything else: terms, contracts, order confirmations, proforma, quotes, renewal notices, marketing.
Reply with exactly one word: INVOICE, REPORT, or OTHER.`;

  try {
    const res = await callGemini(geminiKey, prompt, base64, mimeType, 0);
    const text = (res ?? "").trim().toUpperCase().split(/\s+/)[0].replace(/[^A-Z]/g, "");
    return ["INVOICE","REPORT","OTHER"].includes(text) ? text : "INVOICE";
  } catch { return "INVOICE"; }
}

async function analyzeInvoice({ base64, mimeType, geminiKey, myNames, myHp,
  businessNature, allCategories, emailDate, msgFrom, invoicePlatforms,
  aiTemperature, aiPromptOverride }: any): Promise<any> {

  const allNamesStr    = myNames.map((n: string) => `"${n}"`).join(", ");
  const senderContext  = (msgFrom && !invoicePlatforms.some((p: string) =>
    msgFrom.toLowerCase().includes(p.toLowerCase())))
    ? `\n  EMAIL SENDER: "${msgFrom}" — likely VENDOR/ISSUER.` : "";
  const businessContext = businessNature
    ? `\n  BUSINESS NATURE: "${businessNature}". Use this context when categorizing expenses.` : "";
  const fileContext = `\n  INPUT CONTEXT: Real file attached. Analyze ONLY the file.`;

  const FALLBACK_PROMPT = `You are an expert Israeli accountant.
Owner Identity: Names [${allNamesStr}], VAT/ID "${myHp}".${fileContext}${senderContext}${businessContext}

CRITICAL: Return a JSON ARRAY of ALL invoices found.
Single invoice → still return array: [{"vendor":"..."}]
NON_FINANCIAL / INCOME / LINK_ONLY_INVOICE → return single object (NOT array): {"document_type":"NON_FINANCIAL"}

Rules:
1. ISSUER: 'לכבוד'/'Bill To'/'Billed To' = customer ALWAYS. Never confuse with issuer.
2. INCOME — MANDATORY CHECK: If issuer VAT/ID = "${myHp}" OR issuer name matches ANY of [${allNamesStr}] → ALWAYS {"document_type":"INCOME"}.
3. NON_FINANCIAL: Any document NOT one of: חשבונית מס / קבלה / חשבונית מס קבלה / חשבונית זיכוי.
4. OWNERSHIP — STRICT: ACCEPT only if "Billed To"/"לכבוד" is empty/anonymous, exact match to ANY of [${allNamesStr}], or contains VAT/ID "${myHp}".
5. CATEGORIZATION: Choose from this exact list: [${allCategories.join(", ")}].
6. document_type: EXACTLY one of: "חשבונית מס","קבלה","חשבונית מס קבלה","חשבונית זיכוי".
7. allocation_number: digits only for חשבונית מס/חשבונית מס קבלה. Empty if not found.
8. CURRENCY: "ILS" for ₪. Non-ILS → vat=0.
9. SUPPLIER TAX STATUS: "EXEMPT" if document explicitly says עוסק פטור/זעיר. "REGISTERED" if בע"מ/עוסק מורשה/ח.פ present. "UNKNOWN" if not found.

Return ONLY valid JSON array:
[{"vendor":"","supplier_vat_number":"","supplier_tax_status":"","invoice_number":"","total":0,"vat":0,"currency":"ILS","category":"","document_type":"","payment_date":"","invoice_date":"","allocation_number":"","billed_to":"","is_credit":false,"is_receipt_only":false,"learned_keywords":[]}]`;

  const prompt = aiPromptOverride
    ? aiPromptOverride
        .replace(/\{\{NAMES\}\}/g, allNamesStr)
        .replace(/\{\{VAT\}\}/g, myHp)
        .replace(/\{\{CATEGORIES\}\}/g, allCategories.join(", "))
        .replace(/\{\{FILE_CTX\}\}/g, fileContext)
        .replace(/\{\{SENDER_CTX\}\}/g, senderContext)
        .replace(/\{\{BUSINESS_CTX\}\}/g, businessContext)
    : FALLBACK_PROMPT;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) await sleep(attempt === 1 ? 2000 : 5000);
      const mimeForAttempt = (attempt === 1 && mimeType === "application/pdf") ? "image/jpeg" : mimeType;
      const raw = await callGemini(geminiKey, prompt, base64, mimeForAttempt, aiTemperature ?? 0.1);
      if (!raw) continue;
      const cleaned = raw.replace(/```json/gi,"").replace(/```/g,"").trim();
      let out: any;
      try { out = JSON.parse(cleaned); } catch { continue; }
      if (!out) continue;
      if (!Array.isArray(out)) return out;
      return out.filter((item: any) => item && typeof item === "object")
        .map((item: any) => normalizeInvoiceItem(item));
    } catch(e) { console.error(`analyzeInvoice attempt ${attempt}:`, e); }
  }
  return null;
}

function normalizeInvoiceItem(item: any): any {
  const VALID_TYPES = ["חשבונית מס","קבלה","חשבונית מס קבלה","חשבונית זיכוי","NON_FINANCIAL","LINK_ONLY_INVOICE","חשבונית עסקה","PROTECTED_PDF"];
  const MAP: Record<string,string> = {
    "receipt":"קבלה","invoice":"חשבונית מס","tax invoice":"חשבונית מס",
    "credit":"חשבונית זיכוי","credit note":"חשבונית זיכוי","tax receipt":"חשבונית מס קבלה",
  };
  const dt = String(item.document_type ?? "").trim();
  const normalizedType = VALID_TYPES.includes(dt) ? dt : (MAP[dt.toLowerCase()] ?? "חשבונית מס");
  return {
    vendor:              String(item.vendor || "לא ידוע"),
    supplier_vat_number: String(item.supplier_vat_number || "").replace(/\D/g,"").slice(0,9),
    supplier_tax_status: ["EXEMPT","REGISTERED","UNKNOWN"].includes(String(item.supplier_tax_status||"").toUpperCase())
                         ? String(item.supplier_tax_status).toUpperCase() : "UNKNOWN",
    invoice_number:      String(item.invoice_number || "ללא"),
    total:               sanitizeNumber(item.total),
    vat:                 sanitizeNumber(item.vat),
    currency:            String(item.currency || "ILS").toUpperCase().trim(),
    category:            String(item.category || "אחר"),
    document_type:       normalizedType,
    payment_date:        String(item.payment_date  || ""),
    invoice_date:        String(item.invoice_date  || ""),
    allocation_number:   String(item.allocation_number || "").trim(),
    billed_to:           String(item.billed_to || "").trim(),
    is_credit:           Boolean(item.is_credit) || ["חשבונית זיכוי","credit","credit note"].includes(dt.toLowerCase()),
    is_receipt_only:     Boolean(item.is_receipt_only) || normalizedType === "קבלה",
    learned_keywords:    Array.isArray(item.learned_keywords) ? item.learned_keywords : [],
    fx_note:             "",
  };
}

async function checkDuplicateSmart(supabase: any, clientId: string, {
  invoiceNumber, vendor, total, invoiceDate, lookbackRows
}: any): Promise<{ isExact: boolean; isSuspected: boolean; existingVendor?: string }> {

  const hasNum = invoiceNumber && invoiceNumber !== "ידני" &&
                 invoiceNumber !== "ללא" && !invoiceNumber.startsWith("MAN-");

  const { data: rows } = await supabase
    .from("invoices")
    .select("vendor, invoice_number, total, invoice_date")
    .eq("client_id", clientId)
    .eq("is_archived", false)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(lookbackRows ?? 1000);

  if (!rows?.length) return { isExact: false, isSuspected: false };

  const normAI    = normalizeVendor(vendor);
  const aiTokens  = normAI.split(/\s+/).filter((w: string) => w.length > 1);

  for (const row of rows) {
    const rowTotal = Math.abs(sanitizeNumber(row.total));
    if (Math.abs(rowTotal - Math.abs(total)) > 0.01) continue;

    const normSheet   = normalizeVendor(String(row.vendor ?? ""));
    const sheetTokens = normSheet.split(/\s+/).filter((w: string) => w.length > 1);
    const matchCount  = aiTokens.filter((t: string) => sheetTokens.includes(t)).length;
    const isVendorMatch = matchCount >= 2 || (matchCount >= 1 &&
      (aiTokens.length === 1 || sheetTokens.length === 1));

    if (hasNum) {
      const sheetNum = String(row.invoice_number ?? "").replace(/['"]/g,"").trim();
      const aiNum    = String(invoiceNumber).replace(/['"]/g,"").trim();
      if (sheetNum.toLowerCase() === aiNum.toLowerCase()) {
        if (isVendorMatch) return { isExact: true, isSuspected: false };
        return { isExact: false, isSuspected: true, existingVendor: row.vendor };
      }
    } else if (invoiceDate && isVendorMatch) {
      const d1 = new Date(row.invoice_date ?? "");
      const d2 = new Date(invoiceDate);
      if (!isNaN(d1.getTime()) && !isNaN(d2.getTime()) &&
          Math.abs(d1.getTime() - d2.getTime()) <= 7 * 24 * 60 * 60 * 1000) {
        return { isExact: false, isSuspected: true, existingVendor: row.vendor };
      }
    }
  }
  return { isExact: false, isSuspected: false };
}

async function saveFlow(supabase: any, uid: string, clientId: string,
  chatId: string, flowType: string, invoiceData: any, fileUrl: string) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("invoice_flows").insert({
    id: uid, client_id: clientId, chat_id: chatId,
    flow_type: flowType, invoice_data: invoiceData,
    file_url: fileUrl, expires_at: expiresAt,
  });
}

async function callGemini(
  apiKey: string, prompt: string, base64: string,
  mimeType: string, temperature: number
): Promise<string | null> {
  const models = [
    "models/gemini-2.0-flash",
    "models/gemini-1.5-flash",
  ];
  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: base64 } },
            ]}],
            generationConfig: {
              temperature,
              maxOutputTokens: 2048,
              response_mime_type: "application/json",
            },
          }),
        }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts ?? [];
      const text  = (parts.find((p: any) => p.text && !p.thought)?.text ?? "").trim();
      if (text) return text;
    } catch { continue; }
  }
  return null;
}

async function getFxRate(currency: string): Promise<number | null> {
  try {
    const today = new Date().toISOString().slice(0,10);
    for (let i = 0; i < 4; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0,10);
      const res = await fetch(
        `https://boi.org.il/PublicApi/GetExchangeRates?exportType=json&rateDate=${dateStr}`
      );
      if (!res.ok) continue;
      const data = await res.json();
      const entry = (data?.ResultData ?? []).find((r: any) =>
        r.Key?.toUpperCase() === currency.toUpperCase()
      );
      if (entry?.CurrentExchangeRate) return entry.CurrentExchangeRate;
    }
  } catch(e) { console.error("getFxRate:", e); }
  return null;
}

function parseGlobalSettings(rows: any[]): any {
  const g: Record<string, any> = {};
  for (const row of rows) {
    try { g[row.key] = JSON.parse(row.value); }
    catch { g[row.key] = row.value; }
  }
  return {
    vat_rules:                 g.vat_rules                ?? {},
    income_tax_rules:          g.income_tax_rules         ?? {},
    no_vat_categories:         g.no_vat_categories        ?? [],
    categories:                g.categories               ?? [],
    allocation_threshold_before: Number(g.allocation_threshold_before ?? 10000),
    allocation_threshold_after:  Number(g.allocation_threshold_after  ?? 5000),
    duplicate_lookback_rows:   Number(g.duplicate_lookback_rows       ?? 1000),
    food_vendors_regex:        g.food_vendors_regex        ?? "",
    invoice_platforms:         g.invoice_platforms         ?? [],
    ai_temperature:            Number(g.ai_temperature    ?? 0.1),
    vat_rate_percent:          Number(g.vat_rate_percent  ?? 18),
    max_distance:              Number(g.max_distance       ?? 2),
    prompt_classify_document:  typeof g.prompt_classify_document === "string" ? g.prompt_classify_document : null,
    prompt_analyze_invoice:    typeof g.prompt_analyze_invoice   === "string" ? g.prompt_analyze_invoice   : null,
  };
}

function getOwnerNames(client: any): string[] {
  const aliases = Array.isArray(client.owner_aliases) ? client.owner_aliases : [];
  const name    = client.brand_name ?? "";
  return [...new Set([name, ...aliases].filter(Boolean))];
}

function getAllocThreshold(client: any, G: any): { before: number; after: number; date: string } {
  return {
    before: client.alloc_threshold_before ?? G.allocation_threshold_before,
    after:  client.alloc_threshold_after  ?? G.allocation_threshold_after,
    date:   "2026-06-01",
  };
}

function requiresAllocationNumber(aiData: any, invoiceDate: string,
  threshold: { before: number; after: number; date: string }): boolean {
  if (!["חשבונית מס","חשבונית מס קבלה"].includes(aiData.document_type)) return false;
  if (aiData.is_credit) return false;
  const total = Math.abs(sanitizeNumber(aiData.total));
  const limit = invoiceDate >= threshold.date ? threshold.after : threshold.before;
  return total > limit;
}

function isTaxi(category: string): boolean {
  return category === "מוניות";
}

function isFood(vendor: string, foodRegex: string): boolean {
  if (!foodRegex) return false;
  try { return new RegExp(foodRegex, "i").test(vendor ?? ""); }
  catch { return false; }
}

function verifyOwnership(billedTo: string, myNames: string[], myHp: string,
  maxDistance: number): boolean {
  if (!billedTo?.trim()) return true;
  const ANON = /^(לקוח כללי|לקוח פרטי|קופה|cash|anonymous|guest|walk.?in|פרטי|general|כללי)/i;
  if (ANON.test(billedTo.trim())) return true;
  const bt = billedTo.trim().toLowerCase();
  if (myHp && bt.includes(myHp)) return true;
  for (const name of myNames) {
    if (!name) continue;
    const n = name.trim().toLowerCase();
    if (bt.includes(n) || n.includes(bt)) return true;
    if (levenshtein(bt, n) <= Math.min(maxDistance, Math.floor(n.length / 2))) return true;
  }
  return false;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({length: m+1}, (_,i) => [i]);
  for (let j=1; j<=n; j++) dp[0][j] = j;
  for (let i=1; i<=m; i++) for (let j=1; j<=n; j++) {
    dp[i][j] = a[i-1]===b[j-1] ? dp[i-1][j-1]
      : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  }
  return dp[m][n];
}

function normalizeVendor(name: string): string {
  const STRIP = ["בע\"מ","בעמ","בע.מ","בע.מ.","ח.פ","ע.מ","עוסק מורשה","עוסק פטור","בית עסק","ltd","inc","co","corp","llc","gmbh"];
  let s = String(name ?? "").trim().toLowerCase();
  for (const sfx of STRIP) s = s.replace(new RegExp(`\\b${sfx}\\b`, "gi"), "");
  return s.replace(/[^\u05D0-\u05EAa-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function normalizeDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return dateStr;
  const dmy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`;
  return null;
}

function sanitizeNumber(val: any): number {
  const n = parseFloat(String(val ?? "").replace(/[^\d.\-]/g, ""));
  return isNaN(n) ? 0 : Math.abs(n);
}

function makeUid(): string {
  return crypto.randomUUID().replace(/-/g,"").slice(0,8);
}

function escHtml(s: string): string {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json" },
  });
}

async function getClientChatIds(supabase: any, clientId: string, primaryChatId: string): Promise<string[]> {
  try {
    const { data } = await supabase
      .from("client_telegram_users")
      .select("chat_id")
      .eq("client_id", clientId)
      .eq("is_active", true);
    if (data?.length) return data.map((r: any) => r.chat_id);
  } catch(e) { console.error("getClientChatIds:", e); }
  // fallback — שלח ל-chat_id הראשי בלבד
  return [primaryChatId];
}

async function broadcastMessage(supabase: any, clientId: string, primaryChatId: string, text: string, parseMode?: string, keyboard?: any) {
  const chatIds = await getClientChatIds(supabase, clientId, primaryChatId);
  for (const chatId of chatIds) {
    if (keyboard) {
      await sendMessageKb(chatId, text, keyboard, parseMode);
    } else {
      await sendMessage(chatId, text, parseMode);
    }
  }
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

async function sendMessageKb(chatId: string, text: string, keyboard: any, parseMode?: string) {
  if (!BOT_TOKEN) return;
  const body: any = { chat_id: chatId, text, reply_markup: keyboard };
  if (parseMode) body.parse_mode = parseMode;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
