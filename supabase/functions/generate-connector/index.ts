import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CONNECTOR_SECRET    = Deno.env.get("CONNECTOR_SECRET")    ?? "";
const INBOT_SYNC_SECRET   = Deno.env.get("INBOT_SYNC_SECRET")   ?? "";
const SUPABASE_URL        = Deno.env.get("SUPABASE_URL")        ?? "";
const APP_URL             = Deno.env.get("APP_URL")             ?? "https://app.inbot.co.il";

Deno.serve(async (req) => {
  // אימות — לקוח מחובר בלבד
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return json({ error: "Unauthorized" }, 401);

  // שליפת פרטי לקוח
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: client, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("id, brand_name")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (clientError || !client) {
    return json({ error: "Client not found" }, 404);
  }

  // בניית תוכן קובץ ה-GAS
  const processInvoiceUrl = `${SUPABASE_URL}/functions/v1/process-invoice`;
  const getSettingsUrl    = `${SUPABASE_URL}/functions/v1/get-client-settings`;

  const connectorCode = getConnectorTemplate()
    .replace(/__CLIENT_UUID__/g,         client.id)
    .replace(/__SUPABASE_URL__/g,         SUPABASE_URL)
    .replace(/__CONNECTOR_SECRET__/g,     CONNECTOR_SECRET)
    .replace(/__PROCESS_INVOICE_URL__/g,  processInvoiceUrl)
    .replace(/__INBOT_SYNC_SECRET__/g,    INBOT_SYNC_SECRET)
    .replace(/__GET_SETTINGS_URL__/g,     getSettingsUrl);

  // שם קובץ בטוח
  const safeName = (client.brand_name ?? "connector")
    .replace(/[^א-תa-zA-Z0-9_-\s]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 30);

  return new Response(connectorCode, {
    status: 200,
    headers: {
      "Content-Type":        "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="INBOT_Connector_${safeName}.gs"`,
    },
  });
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getConnectorTemplate(): string {
  return `/**
 * ============================================================
 *  INBOT Connector v3.0
 *  סריקת Gmail + שליחה ל-Supabase Edge Functions
 *
 *  ⚠️ קובץ זה נוצר אוטומטית — אל תערוך את הקבועים בראש הקובץ
 * ============================================================
 */

// ─── קבועים מוטמעים בזמן הורדה ──────────────────────────────
const CLIENT_UUID         = "__CLIENT_UUID__";
const SUPABASE_URL        = "__SUPABASE_URL__";
const CONNECTOR_SECRET    = "__CONNECTOR_SECRET__";
const PROCESS_INVOICE_URL = "__PROCESS_INVOICE_URL__";
const INBOT_SYNC_SECRET   = "__INBOT_SYNC_SECRET__";
const GET_SETTINGS_URL    = "__GET_SETTINGS_URL__";

// ─── הגדרות ברירת מחדל ──────────────────────────────────────
const DEFAULT_CONFIG = {
  GMAIL_SEARCH_DAYS: 60, GMAIL_THREAD_LIMIT: 10, MAX_LOGO_BYTES: 25000,
  PROCESSED_HISTORY_LIMIT: 500, FETCH_RETRIES: 3,
  GMAIL_BASE_TERMS: '(חשבונית OR קבלה OR חשבון OR חיוב OR invoice OR receipt OR billing OR payment OR charge OR "מסמך ממוחשב" OR "אישור תשלום")',
  GMAIL_ATTACH_CONDITION: '(has:attachment OR "להורדת" OR "לצפייה" OR "לצפיה" OR "קישור" OR "download" OR "link" OR "view")',
  NOTIFICATION_ONLY_PHRASES: ["מסמך מוכן לצפייה","החיוב יבוצע באופן אוטומטי","התשלום יבוצע באופן אוטומטי","הודעת חיוב","document is ready","your invoice is ready","automatic payment"],
  DOWNLOAD_LINK_REGEX: /(invoice|download|bill|token|view|pdf|doc|document|receipt|file|show|pay|חשבונית|קבלה)/i,
  DOMAIN_ALIASES: { "cardcom": ["cardcom.solutions","cardcom.co.il","mycardcom.co.il"], "pango": ["pango.co.il","DoNotReply@pango.co.il","4500.co.il","mcpsmartphonews.4500.co.il"], "moovit": ["moovit.com","moovit-pango.co.il","DoNotReply@moovit-pango.co.il"], "upress": ["upress.co.il","billing@upress.co.il"] }
};

function getConnProp(key) { return (PropertiesService.getScriptProperties().getProperty(key) || "").trim(); }
function setConnProp(key, value) { PropertiesService.getScriptProperties().setProperty(key, String(value || "").trim()); }
function getParsedProp(key, fallback) { try { return JSON.parse(getConnProp(key)) || fallback; } catch { return fallback; } }

function runSetupWizard() {
  const ui = SpreadsheetApp.getUi();
  ui.alert("⚙️ INBOT Setup Wizard", "בניית הסביבה המקומית.\\nלחץ OK להתחיל.", ui.ButtonSet.OK);
  const ss = SpreadsheetApp.create("INBOT — חשבוניות");
  const sheetId = ss.getId();
  const sheetUrl = ss.getUrl();
  let invoiceSheet = ss.getActiveSheet();
  invoiceSheet.setName("חשבוניות");
  invoiceSheet.getRange(1, 1, 1, 16).setValues([["תאריך חשבונית","ספק","מספר חשבונית","סכום כולל","מע\\"מ מקורי","מע\\"מ מוכר","הוצאה מוכרת","קטגוריה","קישור לקובץ","הערה 1","הערה 2","ת.ז / ח.פ תורם","תאריך תשלום","סוג מסמך","מספר הקצאה","הערת מטבע"]]);
  invoiceSheet.setFrozenRows(1);
  invoiceSheet.hideColumns(10, 2);
  invoiceSheet.getRange(1,1,1,16).setBackground("#1e3a5f").setFontColor("#ffffff").setFontWeight("bold");
  const processedSheet = ss.insertSheet("_inbot_processed");
  processedSheet.hideSheet();
  const folder = DriveApp.createFolder("INBOT_Invoices");
  folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const driveFolderId = folder.getId();
  const scriptId = ScriptApp.getScriptId();
  PropertiesService.getScriptProperties().setProperties({ "CLIENT_UUID": CLIENT_UUID, "SHEET_ID": sheetId, "DRIVE_FOLDER_ID": driveFolderId, "SCRIPT_ID": scriptId, "SUPABASE_URL": SUPABASE_URL, "CONNECTOR_SECRET": CONNECTOR_SECRET, "PROCESS_INVOICE_URL": PROCESS_INVOICE_URL, "INBOT_SYNC_SECRET": INBOT_SYNC_SECRET, "GET_SETTINGS_URL": GET_SETTINGS_URL });
  const setupRes = callSupabaseSetup({ client_uuid: CLIENT_UUID, sheet_id: sheetId, script_id: scriptId, drive_folder_id: driveFolderId });
  if (!setupRes || setupRes.success === false) {
    ui.alert("⚠️ אזהרה", "השיט ותיקיית Drive נוצרו.\\n⚠️ לא הצלחתי לשלוח ל-INBOT: " + (setupRes?.error || "שגיאת תקשורת") + "\\n\\nSheet: " + sheetUrl + "\\n\\nנסה לרענן דרך הדשבורד.", ui.ButtonSet.OK);
    return;
  }
  setupTriggers();
  syncSettingsFromSupabase();
  ui.alert("✅ Setup הושלם!", "✅ גיליון חשבוניות נוצר\\n✅ תיקיית Drive נוצרה\\n✅ הגדרות נטענו מ-INBOT\\n✅ סריקה אוטומטית הופעלה\\n\\nSheet: " + sheetUrl + "\\n\\nכעת חבר את הטלגרם דרך הדשבורד.", ui.ButtonSet.OK);
}

function syncSettingsFromSupabase() {
  const clientUuid = getConnProp("CLIENT_UUID") || CLIENT_UUID;
  if (!clientUuid) { console.error("CLIENT_UUID חסר"); return false; }
  const settingsUrl = getConnProp("GET_SETTINGS_URL") || GET_SETTINGS_URL;
  const secret = getConnProp("CONNECTOR_SECRET") || CONNECTOR_SECRET;
  try {
    const res = UrlFetchApp.fetch(settingsUrl, { method: "get", headers: { "Authorization": "Bearer " + secret, "X-Client-Id": clientUuid }, muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) { console.error("syncSettings HTTP " + res.getResponseCode()); return false; }
    const data = JSON.parse(res.getContentText());
    if (!data.success) { console.error("syncSettings:", data.error); return false; }
    const G = data.globalSettings, C = data.clientSettings;
    const mergedKnown = [...(G.known_domains_global || []), ...(C.known_domains || [])];
    const mergedFetch = [...(G.fetch_domains_global || []), ...(C.fetch_domains || [])];
    PropertiesService.getScriptProperties().setProperties({
      "ADV_SCANNER": JSON.stringify({ knownDomains: mergedKnown, fetchDomains: mergedFetch, searchDays: G.gmail_search_days || 60, threadLimit: C.thread_limit || 10, maxLogoBytes: C.max_logo_bytes || 25000, baseTerms: G.gmail_base_terms || DEFAULT_CONFIG.GMAIL_BASE_TERMS, attachCond: G.gmail_attach_condition || DEFAULT_CONFIG.GMAIL_ATTACH_CONDITION, notifyPhrases: G.notification_only_phrases || DEFAULT_CONFIG.NOTIFICATION_ONLY_PHRASES }),
      "ADV_AI": JSON.stringify({ businessNature: C.business_nature || "", ownerAliases: C.owner_aliases || [], aiTemperature: C.ai_temperature ?? G.ai_temperature ?? 0.1 }),
      "ADV_ALLOC": JSON.stringify({ customCategories: C.custom_categories || [], allocThresholdBefore: C.alloc_threshold_before ?? G.allocation_threshold_before ?? 10000, allocThresholdAfter: C.alloc_threshold_after ?? G.allocation_threshold_after ?? 5000 }),
      "ADV_PERF": JSON.stringify({ lookbackRows: C.lookback_rows ?? G.duplicate_lookback_rows ?? 1000, maxDistance: C.max_distance ?? 2 }),
      "VAT_RULES_OVERRIDE": JSON.stringify(C.tax_rules?.vat || {}), "TAX_RULES_OVERRIDE": JSON.stringify(C.tax_rules?.tax || {}),
      "GLOBAL_VAT_RULES": JSON.stringify(G.vat_rules || {}), "GLOBAL_INCOME_RULES": JSON.stringify(G.income_tax_rules || {}), "GLOBAL_CATEGORIES": JSON.stringify(G.categories || []),
      "VAT_RATE_PERCENT": String(G.vat_rate_percent || 18), "FOOD_VENDORS_REGEX": G.food_vendors_regex || "",
      "MY_BUSINESS_NAME": C.brand_name || "", "MY_VAT_NUMBER": C.vat_number || "", "GEMINI_API_KEY": C.gemini_api_key || "",
      "LAST_SETTINGS_SYNC": Date.now().toString(), "SETTINGS_REFRESH_REQUESTED": "false"
    });
    if (!getConnProp("USER_EMAIL")) { try { setConnProp("USER_EMAIL", Session.getActiveUser().getEmail()); } catch(e) {} }
    console.log("הגדרות נטענו בהצלחה"); return true;
  } catch(e) { console.error("syncSettings:", e.message); return false; }
}

function scanGmail() {
  const userEmail = getConnProp("USER_EMAIL");
  if (!userEmail) { console.error("USER_EMAIL חסר"); return; }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;
  try {
    const props = PropertiesService.getScriptProperties();
    if (getConnProp("SETTINGS_REFRESH_REQUESTED") === "true") syncSettingsFromSupabase();
    let processed = getParsedProp("PROCESSED_MSG_IDS", []);
    const _sc = getParsedProp("ADV_SCANNER", {});
    const searchDays = _sc.searchDays || DEFAULT_CONFIG.GMAIL_SEARCH_DAYS;
    const threadLimit = _sc.threadLimit || DEFAULT_CONFIG.GMAIL_THREAD_LIMIT;
    const maxLogoBytes = _sc.maxLogoBytes || DEFAULT_CONFIG.MAX_LOGO_BYTES;
    const fetchDomains = _sc.fetchDomains || [];
    const knownDomains = _sc.knownDomains || [];
    const baseTerms = _sc.baseTerms || DEFAULT_CONFIG.GMAIL_BASE_TERMS;
    const attachCond = _sc.attachCond || DEFAULT_CONFIG.GMAIL_ATTACH_CONDITION;
    const notifyPhrases = _sc.notifyPhrases || DEFAULT_CONFIG.NOTIFICATION_ONLY_PHRASES;
    const dialect = getParsedProp("LEARNED_DIALECT", []);
    const dialectStr = dialect.length > 0 ? ' OR "' + dialect.join('" OR "') + '"' : "";
    const timeFilter = "newer_than:" + searchDays + "d";
    const queries = ["(to:" + userEmail + " OR cc:" + userEmail + ") (" + baseTerms + dialectStr + ") " + attachCond + " " + timeFilter];
    for (let i = 0; i < knownDomains.length; i += 25) { const chunk = knownDomains.slice(i, i+25); queries.push("(to:" + userEmail + " OR cc:" + userEmail + ") (from:" + chunk.join(" OR from:") + ") has:attachment " + timeFilter); }
    for (let i = 0; i < fetchDomains.length; i += 15) { const chunk = fetchDomains.slice(i, i+15); queries.push("(to:" + userEmail + " OR cc:" + userEmail + ") (from:" + chunk.join(" OR from:") + ") " + timeFilter); }
    const safeQueryCount = queries.length;
    queries.push("(to:" + userEmail + " OR cc:" + userEmail + ") has:attachment " + timeFilter);
    const scanStart = Date.now(), MAX_MS = 5*60*1000;
    for (let qi = 0; qi < queries.length; qi++) {
      if (Date.now()-scanStart > MAX_MS) break;
      const isSafe = qi < safeQueryCount;
      const threads = GmailApp.search(queries[qi], 0, threadLimit);
      for (let thread of threads) {
        if (Date.now()-scanStart > MAX_MS) break;
        const ignored = getParsedProp("IGNORED_THREADS", []);
        if (ignored.includes(thread.getId())) continue;
        for (let msg of thread.getMessages()) {
          const id = msg.getId();
          if (processed.includes(id)) continue;
          processed.push(id);
          if (processed.length > DEFAULT_CONFIG.PROCESSED_HISTORY_LIMIT) processed.shift();
          const markProcessed = () => props.setProperty("PROCESSED_MSG_IDS", JSON.stringify(processed));
          const msgFrom = msg.getFrom() || "", subject = msg.getSubject() || "", gmailLink = thread.getPermalink(), plainBody = msg.getPlainBody() || "";
          if (!isSafe && !emailHasFinancialSignal(subject, plainBody)) { markProcessed(); continue; }
          let validFiles = msg.getAttachments().filter(f => {
            const mt=(f.getContentType()||"").toLowerCase(), n=(f.getName()||"").toLowerCase();
            if (mt.includes("image") && f.getSize()<maxLogoBytes) return false;
            if (!n||n==="noname"||n==="unnamed"||n==="attachment") return false;
            if (mt.includes("text/html")||mt.includes("text/plain")||mt.includes("text/calendar")) return false;
            if (/\\.(ics|vcf|xml|sig|p7s|pgp|asc)$/i.test(n)) return false;
            const isImg=/(jpg|jpeg|png)/i.test(n)||mt.includes("image/jpeg")||mt.includes("image/png");
            if (isImg) return /invoice|receipt|חשבונית|קבלה/i.test(n)||emailHasFinancialSignal(subject,plainBody);
            return mt.includes("pdf")||mt.includes("octet-stream")||n.endsWith(".pdf")||n.includes("pdf")||n.includes("invoice")||n.includes("receipt")||n.includes("חשבונית")||n.includes("קבלה");
          });
          if (validFiles.length>1) { const hasInv=validFiles.some(f=>/invoice/i.test(f.getName())), hasRec=validFiles.some(f=>/receipt/i.test(f.getName())); if(hasInv&&hasRec) validFiles=validFiles.filter(f=>!/receipt/i.test(f.getName())); }
          if (validFiles.length > 0) {
            let anyFailed=false;
            for (let file of validFiles) { if(!sendToProcessInvoice(file.getBytes(),file.getContentType(),file.getName(),msg.getDate(),gmailLink,msgFrom,subject,/חשבונית/i.test(subject))) anyFailed=true; }
            if (anyFailed) sendTelegramNotification("⚠️ <b>כשל בעיבוד — "+escHtml(getVendorFromEmail(msgFrom))+"</b>\\nנדרש טיפול ידני.", buildGmailKeyboard(gmailLink));
            markProcessed(); continue;
          }
          if (isSenderInFetch(msgFrom, fetchDomains)) {
            const targetLink = extractSmartLink(msg.getBody(), plainBody);
            if (targetLink) {
              try {
                const res = fetchWithRetry(targetLink, { muteHttpExceptions:true, followRedirects:true, headers:{"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36","Accept":"text/html,application/xhtml+xml,application/pdf,*/*;q=0.8","Accept-Language":"he-IL,he;q=0.9,en-US;q=0.8"} });
                if (res.getResponseCode()===403) { sendTelegramNotification("📧 <b>חשבונית ממתינה — "+escHtml(getVendorFromEmail(msgFrom))+"</b>\\nנדרשת פתיחה ידנית (גישה נחסמה).", buildGmailKeyboard(gmailLink)); markProcessed(); continue; }
                const blob=res.getBlob(), ct=(blob.getContentType()||"").toLowerCase();
                if (ct.includes("pdf")||ct.includes("octet-stream")) { blob.setName("fetched_invoice.pdf"); sendToProcessInvoice(blob.getBytes(),"application/pdf","fetched_invoice.pdf",msg.getDate(),gmailLink,msgFrom,subject,false); markProcessed(); continue; }
                if (ct.includes("text/html")) { const inner=extractSmartLink(blob.getDataAsString(),""); if(inner&&inner!==targetLink){const r2=fetchWithRetry(inner,{muteHttpExceptions:true,followRedirects:true}),b2=r2.getBlob(),c2=(b2.getContentType()||"").toLowerCase(); if(c2.includes("pdf")||c2.includes("octet-stream")){b2.setName("fetched_invoice.pdf");sendToProcessInvoice(b2.getBytes(),"application/pdf","fetched_invoice.pdf",msg.getDate(),gmailLink,msgFrom,subject,false);markProcessed();continue;}}}
              } catch(e) { console.error("FETCH error:", e.message); }
            }
            sendTelegramNotification("📧 <b>חשבונית ממתינה — "+escHtml(getVendorFromEmail(msgFrom))+"</b>\\nנדרשת הורדה ידנית.", buildGmailKeyboard(gmailLink)); markProcessed(); continue;
          }
          const NOTIFY=["upress.co.il","4500.co.il","mcpsmartphonews.4500.co.il","moovit.com","moovit-pango.co.il"];
          if (NOTIFY.some(d=>msgFrom.toLowerCase().includes(d))) { sendTelegramNotification("📧 <b>חשבונית ממתינה — "+escHtml(getVendorFromEmail(msgFrom))+"</b>\\nנדרשת כניסה לאזור האישי.", buildGmailKeyboard(gmailLink)); markProcessed(); continue; }
          const notifBody=plainBody||msg.getBody().replace(/<[^>]+>/g," ");
          if (isNotificationOnly(notifBody, notifyPhrases)) { markProcessed(); continue; }
          const unknownLink=extractSmartLink(msg.getBody(),plainBody);
          if (unknownLink) { sendTelegramNotification("📧 <b>חשבונית (קישור) — "+escHtml(getVendorFromEmail(msgFrom))+"</b>\\nספק לא מוכר — נדרשת הורדה ידנית.", buildGmailKeyboard(gmailLink)); markProcessed(); continue; }
          markProcessed();
        }
      }
    }
  } finally { try{PropertiesService.getScriptProperties().setProperty("LAST_SCAN_TS",Date.now().toString());}catch(e){} lock.releaseLock(); }
}

function sendToProcessInvoice(bytes, mimeType, fileName, emailDate, gmailLink, msgFrom, subject, skipClassify) {
  const url=getConnProp("PROCESS_INVOICE_URL")||PROCESS_INVOICE_URL, secret=getConnProp("INBOT_SYNC_SECRET")||INBOT_SYNC_SECRET, uuid=getConnProp("CLIENT_UUID")||CLIENT_UUID, chatId=getConnProp("TELEGRAM_CHAT_ID")||"";
  if (!url||!secret) { console.error("PROCESS_INVOICE_URL או INBOT_SYNC_SECRET חסרים"); return false; }
  try {
    const res=UrlFetchApp.fetch(url,{method:"post",contentType:"application/json",headers:{"Authorization":"Bearer "+secret},payload:JSON.stringify({chat_id:chatId,client_id:uuid,source:"gmail",file_bytes_b64:Utilities.base64Encode(bytes),mime_type:mimeType,email_date:emailDate?emailDate.toISOString():null,msg_from:msgFrom||null,email_subject:subject||null,skip_classify:skipClassify||false}),muteHttpExceptions:true});
    if (res.getResponseCode()!==200){console.error("sendToProcessInvoice HTTP "+res.getResponseCode());return false;}
    return true;
  } catch(e){console.error("sendToProcessInvoice:",e.message);return false;}
}

function callSupabaseSetup(payload) {
  const url=(getConnProp("SUPABASE_URL")||SUPABASE_URL)+"/functions/v1/inbot-complete-setup", secret=getConnProp("INBOT_SYNC_SECRET")||INBOT_SYNC_SECRET;
  try { const res=UrlFetchApp.fetch(url,{method:"post",contentType:"application/json",headers:{"Authorization":"Bearer "+secret},payload:JSON.stringify(payload),muteHttpExceptions:true}); if(res.getResponseCode()!==200){return{success:false,error:"HTTP "+res.getResponseCode()};} return JSON.parse(res.getContentText()); } catch(e){return{success:false,error:e.message};}
}

function setupTriggers() {
  const existing=ScriptApp.getProjectTriggers();
  for(let t of existing){if(["scanGmail","syncSettingsFromSupabase"].includes(t.getHandlerFunction()))ScriptApp.deleteTrigger(t);}
  ScriptApp.newTrigger("scanGmail").timeBased().everyMinutes(10).create();
  ScriptApp.newTrigger("syncSettingsFromSupabase").timeBased().everyDays(1).atHour(3).create();
}

function sendTelegramNotification(text, keyboard) {
  const chatId=getConnProp("TELEGRAM_CHAT_ID"), botToken=getConnProp("BOT_TOKEN");
  if (!chatId||!botToken) return;
  try { const payload={chat_id:chatId,text,parse_mode:"HTML"}; if(keyboard)payload.reply_markup=keyboard; UrlFetchApp.fetch("https://api.telegram.org/bot"+botToken+"/sendMessage",{method:"post",contentType:"application/json",payload:JSON.stringify(payload),muteHttpExceptions:true}); } catch(e){console.error("sendTelegram:",e.message);}
}

function emailHasFinancialSignal(subject,plainBody){const text=(subject+" "+plainBody).toLowerCase();return/(חשבונית|קבלה|חשבון|חיוב|invoice|receipt|billing|payment|charge|bill\\b)/.test(text);}
function isNotificationOnly(body,phrases){if(!body)return false;const lower=body.toLowerCase();return(phrases||DEFAULT_CONFIG.NOTIFICATION_ONLY_PHRASES).some(p=>lower.includes(p.toLowerCase()));}
function isSenderInFetch(msgFrom,fetchDomains){if(!msgFrom)return false;const from=msgFrom.toLowerCase();if(fetchDomains.some(d=>from.includes(d.toLowerCase())))return true;for(let[,aliases]of Object.entries(DEFAULT_CONFIG.DOMAIN_ALIASES)){const sm=aliases.some(a=>from.includes(a.toLowerCase()));if(!sm)continue;if(fetchDomains.some(d=>aliases.some(a=>d.toLowerCase()===a.toLowerCase())))return true;}return false;}
function getVendorFromEmail(msgFrom){if(!msgFrom)return"ספק";return msgFrom.split("<")[0].replace(/['"]/g,"").trim()||"ספק";}
function buildGmailKeyboard(gmailLink){const c=(gmailLink||"").replace(/\\/u\\/\\d+\\//,"/");return{inline_keyboard:[[{text:"📧 פתח ב-Gmail",url:c}]]};}
function extractSmartLink(htmlBody,plainBody){const urls=[];const hr=/href="([^"]+)"/ig;let m;while((m=hr.exec(htmlBody||""))!==null)urls.push(m[1].replace(/&amp;/g,"&"));const pr=/(https?:\\/\\/[^\\s<>"]+)/ig;while((m=pr.exec(plainBody||""))!==null){const u=m[1].replace(/[.,;:)>\\]]+$/,"");if(!urls.includes(u))urls.push(u);}const du=urls.map(u=>{const t=u.match(/[?&](lstr|url|link|redirect|redirect_url|u|target|dest|q|file)=([^&]+)/i);if(t){try{const d=decodeURIComponent(t[2]);if(d.startsWith("http"))return d;let b=d.replace(/-/g,"+").replace(/_/g,"/");while(b.length%4!==0)b+="=";const r=Utilities.newBlob(Utilities.base64Decode(b)).getDataAsString();if(r.startsWith("http"))return r;}catch(e){}}return u;});const ex=[u=>/api\\.rivhit\\.co\\.il\\/pdf\\//i.test(u),u=>/icount\\.co\\.il.*\\/m\\/v\\//i.test(u),u=>/invoice4u\\.co\\.il.*PDF\\.aspx/i.test(u),u=>/ezcount\\.co\\.il\\/d\\//i.test(u),u=>/meshulam\\.co\\.il/i.test(u),u=>/cardcom\\.solutions\\/Invoice/i.test(u),u=>/morning\\.co\\/d\\//i.test(u),u=>/greeninvoice\\.co\\.il\\/d\\//i.test(u),u=>/sumit\\.co\\.il\\/invoices\\//i.test(u)];for(const e of ex){const f=du.find(u=>u.startsWith("http")&&e(u));if(f)return f;}const dp=du.find(u=>u.startsWith("http")&&u.toLowerCase().split("?")[0].endsWith(".pdf"));if(dp)return dp;return du.find(u=>u.startsWith("http")&&DEFAULT_CONFIG.DOWNLOAD_LINK_REGEX.test(u))||null;}
function fetchWithRetry(url,options,retries){const max=retries||DEFAULT_CONFIG.FETCH_RETRIES;for(let i=0;i<max;i++){try{const r=UrlFetchApp.fetch(url,options||{});if(r.getResponseCode()===429){if(i<max-1){Utilities.sleep(1000*Math.pow(2,i));continue;}throw new Error("Rate limited (429)");}return r;}catch(e){if(i===max-1)throw e;Utilities.sleep(1000*Math.pow(2,i));}}}
function escHtml(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function onOpen(){SpreadsheetApp.getUi().createMenu("⚙️ INBOT").addItem("🔧 Setup Wizard (פעם ראשונה)","runSetupWizard").addItem("🔄 רענן הגדרות מ-INBOT","syncSettingsFromSupabase").addItem("▶️ סרוק Gmail עכשיו","scanGmail").addItem("⚙️ הגדר Triggers","setupTriggers").addToUi();}
`;
}
