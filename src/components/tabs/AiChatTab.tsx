import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClientRecord } from "@/hooks/useClientData";
import { toast } from "sonner";
import { Bot, User, Send, Trash2, AlertTriangle } from "lucide-react";

interface Invoice {
  id: string;
  invoice_date: string | null;
  vendor: string | null;
  invoice_number: string | null;
  total: number | null;
  vat_original: number | null;
  vat_deductible: number | null;
  tax_deductible: number | null;
  category: string | null;
  document_type: string | null;
  allocation_number: string | null;
  drive_file_url: string | null;
}

interface ChatMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  loading?: boolean;
}

const WELCOME_MSG: ChatMessage = {
  id: "welcome",
  role: "bot",
  text: "שלום! אני יכול לענות על שאלות על ההוצאות שלך. לדוגמה:\nכמה הוצאתי על תקשורת השנה?\nמה הספק הכי יקר שלי?\nכמה מע״מ לקיזוז הרבעון הזה?",
};

const QUICK_PROMPTS = [
  "כמה הוצאתי החודש?",
  "מה הספק הכי יקר שלי?",
  "כמה מע״מ לקיזוז הרבעון?",
  "אילו חשבוניות ללא מספר הקצאה?",
  "השווה הוצאות חודש זה לחודש קודם",
];

function parseDDMMYYYY(s: string): Date | null {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1]);
}

function formatBotText(text: string): string {
  return text
    .replace(/\n/g, "<br/>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function buildDataSummary(invoices: Invoice[]) {
  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;

  const catSums: Record<string, { total: number; count: number; vat: number; tax: number }> = {};
  const vendorSums: Record<string, { total: number; count: number; category: string; lastDate: string }> = {};
  const monthSums: Record<string, { total: number; count: number; vat: number }> = {};
  const vendorMonthSums: Record<string, { vendor: string; month: string; total: number; count: number }> = {};

  let totalAmount = 0, totalVat = 0, totalTax = 0;
  let minDate = "", maxDate = "";

  const rows = invoices.map((r) => {
    const t = r.total ?? 0;
    const v = r.vat_deductible ?? 0;
    const tx = r.tax_deductible ?? 0;
    const cat = r.category ?? "ללא";
    const vendor = r.vendor ?? "ללא";
    const dateStr = r.invoice_date ?? "";

    totalAmount += t;
    totalVat += v;
    totalTax += tx;

    if (!minDate || dateStr < minDate) minDate = dateStr;
    if (!maxDate || dateStr > maxDate) maxDate = dateStr;

    // category sums
    if (!catSums[cat]) catSums[cat] = { total: 0, count: 0, vat: 0, tax: 0 };
    catSums[cat].total += t;
    catSums[cat].count++;
    catSums[cat].vat += v;
    catSums[cat].tax += tx;

    // vendor sums
    if (!vendorSums[vendor]) vendorSums[vendor] = { total: 0, count: 0, category: cat, lastDate: dateStr };
    vendorSums[vendor].total += t;
    vendorSums[vendor].count++;
    if (dateStr > vendorSums[vendor].lastDate) vendorSums[vendor].lastDate = dateStr;

    // month sums
    const parsed = parseDDMMYYYY(dateStr);
    const mKey = parsed ? `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}` : "unknown";
    if (!monthSums[mKey]) monthSums[mKey] = { total: 0, count: 0, vat: 0 };
    monthSums[mKey].total += t;
    monthSums[mKey].count++;
    monthSums[mKey].vat += v;

    // vendor month
    const vmKey = `${vendor}|${mKey}`;
    if (!vendorMonthSums[vmKey]) vendorMonthSums[vmKey] = { vendor, month: mKey, total: 0, count: 0 };
    vendorMonthSums[vmKey].total += t;
    vendorMonthSums[vmKey].count++;

    return { date: dateStr, vendor, num: r.invoice_number, total: Math.round(t), vat: Math.round(v), cat, docType: r.document_type, notes: "" };
  });

  const noAllocList = invoices.filter(
    (r) =>
      !r.allocation_number &&
      (r.total ?? 0) >= 10000 &&
      ["חשבונית מס", "חשבונית מס קבלה"].includes(r.document_type ?? "")
  );

  const byCategory = Object.entries(catSums)
    .map(([k, v]) => ({ category: k, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);

  const byVendor = Object.entries(vendorSums)
    .map(([k, v]) => ({ vendor: k, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 30);

  const byMonth = Object.entries(monthSums)
    .map(([k, v]) => ({ month: k, ...v }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const byVendorMonth = Object.values(vendorMonthSums).sort((a, b) => a.month.localeCompare(b.month) || a.vendor.localeCompare(b.vendor));

  return {
    today: now.toISOString().slice(0, 10),
    thisMonthKey,
    lastMonthKey,
    totalInvoices: invoices.length,
    totalAmount: Math.round(totalAmount),
    totalVat: Math.round(totalVat),
    totalTax: Math.round(totalTax),
    dateRange: { from: minDate, to: maxDate },
    thisMonth: monthSums[thisMonthKey] ?? { total: 0, count: 0, vat: 0 },
    lastMonth: monthSums[lastMonthKey] ?? { total: 0, count: 0, vat: 0 },
    byCategory,
    byVendor,
    byMonth,
    byVendorMonth,
    noAllocCount: noAllocList.length,
    noAllocVendors: noAllocList.map((r) => ({ vendor: r.vendor, total: r.total, date: r.invoice_date })),
    rows,
  };
}

export default function AiChatTab() {
  const { data: client } = useClientRecord();
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [geminiKey, setGeminiKey] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([WELCOME_MSG]);
  const [chatInput, setChatInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => { scrollToBottom(); }, [chatHistory]);

  // Fetch invoices & key
  useEffect(() => {
    if (!client?.id) return;
    (async () => {
      setIsDataLoading(true);
      const [invRes, clientRes] = await Promise.all([
        supabase.from("invoices").select("id, invoice_date, vendor, invoice_number, total, vat_original, vat_deductible, tax_deductible, category, document_type, allocation_number, drive_file_url").eq("client_id", client.id),
        supabase.from("clients").select("gemini_api_key").eq("id", client.id).maybeSingle(),
      ]);
      if (invRes.data) setAllInvoices(invRes.data);
      if (clientRes.data) setGeminiKey(clientRes.data.gemini_api_key);
      setIsDataLoading(false);

      if (invRes.data && invRes.data.length === 0) {
        setChatHistory((h) => [...h, { id: "no-data", role: "bot", text: "לא נמצאו חשבוניות. ייבא חשבוניות כדי שאוכל לענות על שאלות." }]);
      }
    })();
  }, [client?.id]);

  const sendChat = async (overrideText?: string) => {
    const question = (overrideText ?? chatInput).trim();
    if (!question || isLoading || !geminiKey) return;

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", text: question };
    const loadingMsg: ChatMessage = { id: "loading-msg", role: "bot", text: "...", loading: true };

    setChatHistory((h) => [...h, userMsg, loadingMsg]);
    setChatInput("");
    setIsLoading(true);

    try {
      const summary = buildDataSummary(allInvoices);
      const systemPrompt = `You are an expert Israeli accountant AI assistant.
You help small business owners understand their expenses.
Always answer in Hebrew. Be concise and clear.
Use ₪ for amounts. Format numbers with thousands separators.
Today is ${summary.today}. Current month: ${summary.thisMonthKey}.
The user's expense data is provided as a JSON summary below.
Base all answers strictly on this data — do not invent numbers.
If data is insufficient, say so honestly.
Data summary: ${JSON.stringify(summary)}`;

      const historyForApi = chatHistory
        .filter((m) => m.id !== "welcome" && m.id !== "no-data" && !m.loading)
        .slice(-10);

      const contents = [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "מובן, אני מוכן לעזור." }] },
        ...historyForApi.map((m) => ({
          role: m.role === "bot" ? "model" : "user",
          parts: [{ text: m.text }],
        })),
        { role: "user", parts: [{ text: question }] },
      ];

      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents, generationConfig: { temperature: 0.1, maxOutputTokens: 1024 } }),
        }
      );

      if (!resp.ok) throw new Error("API error");

      const data = await resp.json();
      const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || "לא הצלחתי לקבל תשובה";

      setChatHistory((h) => {
        const filtered = h.filter((m) => m.id !== "loading-msg");
        const updated = [...filtered, { id: `b-${Date.now()}`, role: "bot" as const, text: answer }];
        return updated.slice(-22); // keep ~20 + welcome
      });
    } catch {
      setChatHistory((h) => {
        const filtered = h.filter((m) => m.id !== "loading-msg");
        return [...filtered, { id: `e-${Date.now()}`, role: "bot" as const, text: "שגיאה בחיבור ל-Gemini. בדוק את מפתח ה-API בהגדרות." }];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setChatHistory([WELCOME_MSG]);
    toast("השיחה נוקתה");
  };

  const noKey = !geminiKey && !isDataLoading;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-white" style={{ height: "calc(100vh - 180px)", minHeight: 500 }}>
      {/* Messages area */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
        {noKey && (
          <div className="mx-auto flex items-center gap-2 rounded-lg border px-4 py-3 text-[13px]" style={{ background: "#fffbeb", borderColor: "#fde68a", color: "#b45309" }}>
            <AlertTriangle size={16} />
            ⚠️ מפתח Gemini לא מוגדר. עבור להגדרות כדי להגדיר אותו.
          </div>
        )}

        {chatHistory.map((msg) => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            {/* Avatar */}
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
              style={{ background: msg.role === "bot" ? "#1e3a5f" : "#e8941a" }}
            >
              {msg.role === "bot" ? <Bot size={16} /> : <User size={16} />}
            </div>

            {/* Bubble */}
            {msg.loading ? (
              <div className="rounded-lg border border-border bg-white px-3.5 py-2.5 text-[13px]" style={{ borderRadius: "2px 8px 8px 8px" }}>
                <span className="inline-flex gap-1">
                  <span className="animate-pulse">.</span>
                  <span className="animate-pulse" style={{ animationDelay: "0.2s" }}>.</span>
                  <span className="animate-pulse" style={{ animationDelay: "0.4s" }}>.</span>
                </span>
              </div>
            ) : msg.role === "bot" ? (
              <div
                className="max-w-[70%] rounded-lg border border-border bg-white px-3.5 py-2.5 text-[13px] leading-relaxed"
                style={{ borderRadius: "2px 8px 8px 8px" }}
                dangerouslySetInnerHTML={{ __html: formatBotText(msg.text) }}
              />
            ) : (
              <div
                className="max-w-[70%] rounded-lg px-3.5 py-2.5 text-[13px] leading-relaxed text-white"
                style={{ background: "#1e3a5f", borderRadius: "8px 2px 8px 8px" }}
              >
                {msg.text}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick prompts */}
      {!noKey && (
        <div className="flex flex-wrap gap-1.5 px-5 pb-3">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => sendChat(p)}
              disabled={isLoading}
              className="rounded-full border border-border bg-white px-3 py-1 text-[12px] text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      {!noKey && (
        <div className="flex items-center gap-2 border-t border-border px-5 py-3.5">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isLoading && sendChat()}
            placeholder="שאל שאלה על ההוצאות שלך..."
            disabled={isLoading}
            className="h-[40px] flex-1 rounded-lg border border-border bg-background px-3 text-[13px] outline-none focus:border-primary disabled:opacity-50"
          />
          <button
            onClick={() => sendChat()}
            disabled={isLoading || !chatInput.trim()}
            className="flex h-[40px] w-[40px] items-center justify-center rounded-lg text-white transition-colors disabled:opacity-50"
            style={{ background: "#1e3a5f" }}
          >
            <Send size={16} />
          </button>
          <button
            onClick={clearChat}
            className="flex h-[40px] w-[40px] items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
