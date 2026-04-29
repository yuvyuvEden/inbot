import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClientRecord } from "@/hooks/useClientData";
import { toast } from "sonner";
import { Bot, User, Send, Trash2 } from "lucide-react";

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
  "ספק הכי יקר",
  "מע״מ לרבעון",
  "ללא הקצאה",
  "השוואה חודשית",
];

function parseDDMMYYYY(s: string): Date | null {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1]);
}

function formatBotText(text: string): string {
  // סניטציה — escape תווי HTML לפני כל עיבוד
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  // המרת Markdown בסיסי ל-HTML בטוח
  return escaped
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
      const invRes = await supabase
        .from("invoices")
        .select("id, invoice_date, vendor, invoice_number, total, vat_original, vat_deductible, tax_deductible, category, document_type, allocation_number, drive_file_url")
        .eq("client_id", client.id);
      if (invRes.data) setAllInvoices(invRes.data);
      setIsDataLoading(false);

      if (invRes.data && invRes.data.length === 0) {
        setChatHistory((h) => [...h, { id: "no-data", role: "bot", text: "לא נמצאו חשבוניות. ייבא חשבוניות כדי שאוכל לענות על שאלות." }]);
      }
    })();
  }, [client?.id]);

  const sendChat = async (overrideText?: string) => {
    const question = (overrideText ?? chatInput).trim();
    if (!question || isLoading) return;

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", text: question };
    const loadingMsg: ChatMessage = { id: "loading-msg", role: "bot", text: "...", loading: true };

    setChatHistory((h) => [...h, userMsg, loadingMsg]);
    setChatInput("");
    setIsLoading(true);

    try {
      const summary = buildDataSummary(allInvoices);

      const historyForApi = chatHistory
        .filter((m) => m.id !== "welcome" && m.id !== "no-data" && !m.loading)
        .slice(-10)
        .map((m) => ({ role: m.role, text: m.text }));

      // הוסף את סיכום הנתונים לשאלה — הפרומפט נבנה בשרת
      const questionWithData = `${question}\n\n[DATA:${JSON.stringify(summary)}]`;

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini-proxy`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ question: questionWithData, history: historyForApi }),
        }
      );

      if (!resp.ok) throw new Error(`Gemini proxy error: ${resp.status}`);

      const { text } = await resp.json();
      const answer = text || "לא הצלחתי לקבל תשובה";

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

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-white" style={{ height: "calc(100vh - 180px)", minHeight: 500 }}>
      {/* Messages area */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">

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

      {/* Quick prompts — always visible */}
      <div className="flex flex-wrap gap-1.5 border-t border-border bg-white px-4 py-2">
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => sendChat(p)}
            disabled={isLoading}
            className="rounded-full border border-border bg-white px-3 py-[5px] text-[12px] text-muted-foreground transition-all duration-150 hover:border-primary hover:text-primary disabled:opacity-50"
            style={{ fontFamily: "Heebo, sans-serif" }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input bar — always visible */}
      <div className="flex items-center gap-2 border-t border-border bg-white px-4 py-3">
        <input
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !isLoading && sendChat()}
          placeholder="שאל שאלה על ההוצאות שלך..."
          disabled={isLoading}
          className="h-[40px] flex-1 rounded-lg border border-border px-3 text-[13px] outline-none focus:border-primary disabled:opacity-50"
          style={{ fontFamily: "Heebo, sans-serif" }}
        />
        <button
          onClick={() => sendChat()}
          disabled={isLoading || !chatInput.trim()}
          className="flex items-center justify-center rounded-lg px-3.5 py-2 text-white transition-colors disabled:opacity-50"
          style={{ background: "#1e3a5f" }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
