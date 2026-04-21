import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClientRecord } from "@/hooks/useClientData";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Filter, FileSpreadsheet, FileText, FileDown, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";

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

function parseDDMMYYYY(s: string): Date | null {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1]);
}

function fmtDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function startOfQuarter(d: Date) { return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1); }

const QUICK_FILTERS = [
  { label: "החודש", key: "this_month" },
  { label: "חודש קודם", key: "last_month" },
  { label: "רבעון נוכחי", key: "this_quarter" },
  { label: "השנה", key: "this_year" },
] as const;

function fmtILS(n: number) { return n.toLocaleString("he-IL", { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }

export default function ExportTab() {
  const { data: client } = useClientRecord();
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const today = new Date();
  const [dateFrom, setDateFrom] = useState<Date | undefined>(startOfMonth(today));
  const [dateTo, setDateTo] = useState<Date | undefined>(today);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [activeQuick, setActiveQuick] = useState("this_month");

  useEffect(() => {
    if (!client?.id) return;
    setIsLoading(true);
    supabase
      .from("invoices")
      .select("id,invoice_date,vendor,invoice_number,total,vat_original,vat_deductible,tax_deductible,category,document_type,allocation_number,drive_file_url")
      .eq("client_id", client.id)
      .eq("is_archived", false)
      .is("deleted_at", null)
      .then(({ data, error }) => {
        if (error) { toast.error("שגיאה בטעינת חשבוניות"); console.error(error); }
        setAllInvoices((data as Invoice[]) || []);
        setIsLoading(false);
      });
  }, [client?.id]);

  const categories = useMemo(() => {
    const s = new Set<string>();
    allInvoices.forEach((i) => i.category && s.add(i.category));
    return Array.from(s).sort();
  }, [allInvoices]);

  const filteredInvoices = useMemo(() => {
    return allInvoices.filter((inv) => {
      if (!inv.invoice_date) return false;
      const d = parseDDMMYYYY(inv.invoice_date);
      if (!d) return false;
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      if (selectedCategory && inv.category !== selectedCategory) return false;
      return true;
    });
  }, [allInvoices, dateFrom, dateTo, selectedCategory]);

  const totalSum = useMemo(() => filteredInvoices.reduce((s, i) => s + (i.total || 0), 0), [filteredInvoices]);

  function applyQuick(key: string) {
    setActiveQuick(key);
    const now = new Date();
    let from: Date, to: Date;
    switch (key) {
      case "last_month": {
        const pm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        from = pm; to = endOfMonth(pm); break;
      }
      case "this_quarter": from = startOfQuarter(now); to = now; break;
      case "this_year": from = new Date(now.getFullYear(), 0, 1); to = now; break;
      default: from = startOfMonth(now); to = now;
    }
    setDateFrom(from);
    setDateTo(to);
  }

  /* ---- EXPORT: XLSX ---- */
  function exportXLSX() {
    if (!filteredInvoices.length) { toast.error("אין חשבוניות לייצוא"); return; }
    try {
      const headers = ["תאריך", "ספק", "מספר חשבונית", "סכום", "מע\"מ בפועל", "מע\"מ לקיזוז", "הוצאה מוכרת", "קטגוריה", "סוג מסמך", "מספר הקצאה", "קובץ", "הערות"];
      const rows = filteredInvoices.map((r) => [
        r.invoice_date || "", r.vendor || "", r.invoice_number || "",
        r.total || 0, r.vat_original || 0, r.vat_deductible || 0, r.tax_deductible || 0,
        r.category || "", r.document_type || "", r.allocation_number || "",
        r.drive_file_url || "", "",
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws["!cols"] = [12, 30, 16, 12, 12, 12, 14, 20, 18, 14, 18, 20].map((w) => ({ wch: w }));
      // hyperlinks for drive_file_url
      filteredInvoices.forEach((r, i) => {
        if (r.drive_file_url) {
          const cell = XLSX.utils.encode_cell({ r: i + 1, c: 10 });
          ws[cell] = { t: "s", v: "פתח חשבונית", l: { Target: r.drive_file_url } };
        }
      });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "חשבוניות");
      const fname = `חשבוניות_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fname);
      toast.success("קובץ Excel יוצא בהצלחה");
    } catch (e) { console.error(e); toast.error("שגיאה בייצוא Excel"); }
  }

  /* ---- EXPORT: PDF (new window) ---- */
  function exportPDF() {
    if (!filteredInvoices.length) { toast.error("אין חשבוניות לייצוא"); return; }
    const sumTotal = filteredInvoices.reduce((s, i) => s + (i.total || 0), 0);
    const sumVatOrig = filteredInvoices.reduce((s, i) => s + (i.vat_original || 0), 0);
    const sumVatDed = filteredInvoices.reduce((s, i) => s + (i.vat_deductible || 0), 0);
    const sumTaxDed = filteredInvoices.reduce((s, i) => s + (i.tax_deductible || 0), 0);
    const noAlloc = filteredInvoices.filter((i) => !i.allocation_number).length;
    const dates = filteredInvoices.map((i) => parseDDMMYYYY(i.invoice_date || "")).filter(Boolean) as Date[];
    const periodStr = dates.length
      ? `${fmtDate(new Date(Math.min(...dates.map((d) => d.getTime()))))} — ${fmtDate(new Date(Math.max(...dates.map((d) => d.getTime()))))}`
      : "כל התקופות";

    const tableRows = filteredInvoices.map((r) => `<tr>
      <td>${r.invoice_date || ""}</td><td>${r.vendor || ""}</td><td>${r.invoice_number || ""}</td>
      <td>₪${fmtILS(r.total || 0)}</td><td>₪${fmtILS(r.vat_original || 0)}</td>
      <td>₪${fmtILS(r.vat_deductible || 0)}</td><td>₪${fmtILS(r.tax_deductible || 0)}</td>
      <td>${r.category || ""}</td><td>${r.document_type || ""}</td>
      <td>${r.allocation_number || "—"}</td>
      <td>${r.drive_file_url ? `<a href="${r.drive_file_url}" target="_blank">פתח</a>` : ""}</td>
    </tr>`).join("");

    const html = `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;700;900&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Heebo,Arial,sans-serif;color:#1a202c;padding:32px;font-size:13px}
h1{font-size:22px;font-weight:900;color:#1e3a5f;margin-bottom:4px}
.sub{font-size:12px;color:#64748b;margin-bottom:20px}
.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.summary-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;text-align:center}
.summary-box .label{font-size:10px;text-transform:uppercase;color:#64748b;margin-bottom:4px}
.summary-box .value{font-size:16px;font-weight:900;color:#1e3a5f}
.warn{background:#fffbeb;border:1px solid #fde68a;color:#b45309;padding:10px 14px;border-radius:6px;margin-bottom:16px;font-size:12px}
table{width:100%;border-collapse:collapse;font-size:12px}
th{background:#1e3a5f;color:#fff;padding:8px 6px;text-align:right}
td{padding:7px 6px;border-bottom:1px solid #e2e8f0}
tr:nth-child(even){background:#f8fafc}
tfoot td{font-weight:700;background:#f0f4f8;border-top:2px solid #1e3a5f}
a{color:#0284c7}
.no-print{margin-bottom:20px}
@media print{.no-print{display:none}}
</style></head><body>
<button class="no-print" onclick="window.print()" style="background:#1e3a5f;color:#fff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-family:Heebo;font-size:14px">🖨️ הדפס / שמור PDF</button>
<h1>דוח הוצאות עסקי</h1>
<p class="sub">הופק: ${fmtDate(new Date())} | תקופה: ${periodStr} | סה״כ ${filteredInvoices.length} חשבוניות</p>
<div class="summary">
  <div class="summary-box"><div class="label">סה״כ הוצאות</div><div class="value">₪${fmtILS(sumTotal)}</div></div>
  <div class="summary-box"><div class="label">מע״מ בפועל</div><div class="value">₪${fmtILS(sumVatOrig)}</div></div>
  <div class="summary-box"><div class="label">מע״מ לקיזוז</div><div class="value">₪${fmtILS(sumVatDed)}</div></div>
  <div class="summary-box"><div class="label">הוצאה מוכרת</div><div class="value">₪${fmtILS(sumTaxDed)}</div></div>
</div>
${noAlloc > 0 ? `<div class="warn">⚠️ ${noAlloc} חשבוניות ללא מספר הקצאה — לא יוכרו לקיזוז מע״מ</div>` : ""}
<table><thead><tr>
<th>תאריך</th><th>ספק</th><th>מספר חשבונית</th><th>סכום</th><th>מע"מ בפועל</th><th>מע"מ מוכר</th><th>הוצאה מוכרת</th><th>קטגוריה</th><th>סוג מסמך</th><th>הקצאה</th><th>קובץ</th>
</tr></thead><tbody>${tableRows}</tbody>
<tfoot><tr>
<td colspan="3" style="text-align:left;font-weight:700">סה״כ</td>
<td>₪${fmtILS(sumTotal)}</td><td>₪${fmtILS(sumVatOrig)}</td><td>₪${fmtILS(sumVatDed)}</td><td>₪${fmtILS(sumTaxDed)}</td>
<td colspan="4"></td>
</tr></tfoot></table></body></html>`;

    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
    toast.success("דוח PDF נפתח בחלון חדש");
  }

  /* ---- EXPORT: CSV ---- */
  function exportCSV() {
    if (!filteredInvoices.length) { toast.error("אין חשבוניות לייצוא"); return; }
    try {
      const sep = ",";
      const headers = ["תאריך", "ספק", "מספר חשבונית", "סכום", "מע\"מ בפועל", "מע\"מ לקיזוז", "הוצאה מוכרת", "קטגוריה", "סוג מסמך", "מספר הקצאה", "קישור לקובץ"];
      const rows = filteredInvoices.map((r) =>
        [r.invoice_date || "", r.vendor || "", r.invoice_number || "",
          r.total || 0, r.vat_original || 0, r.vat_deductible || 0, r.tax_deductible || 0,
          r.category || "", r.document_type || "", r.allocation_number || "", r.drive_file_url || ""]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(sep)
      );
      const csv = "\uFEFF" + [headers.map((h) => `"${h}"`).join(sep), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `חשבוניות_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("קובץ CSV יוצא בהצלחה");
    } catch (e) { console.error(e); toast.error("שגיאה בייצוא CSV"); }
  }

  const cardStyle = "bg-white border border-[#e2e8f0] rounded-xl p-6 text-center cursor-pointer transition-all duration-200 hover:border-[#1e3a5f] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,.08)]";

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      {/* Period Selector Card */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,.08)]">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-[#e2e8f0]">
          <Filter size={16} className="text-[#1e3a5f]" />
          <span className="text-[14px] font-bold text-[#1a202c]">בחר תקופה לייצוא</span>
        </div>
        <div className="p-5 space-y-4">
          {/* Row 1 — inputs */}
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[12px] text-[#64748b]">מ-תאריך</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("h-[38px] w-[160px] justify-start text-right text-[13px] font-normal border-[#e2e8f0]", !dateFrom && "text-[#64748b]")}>
                    <CalendarIcon className="ml-2 h-4 w-4 opacity-60" />
                    {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "DD/MM/YYYY"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); setActiveQuick(""); }} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] text-[#64748b]">עד-תאריך</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("h-[38px] w-[160px] justify-start text-right text-[13px] font-normal border-[#e2e8f0]", !dateTo && "text-[#64748b]")}>
                    <CalendarIcon className="ml-2 h-4 w-4 opacity-60" />
                    {dateTo ? format(dateTo, "dd/MM/yyyy") : "DD/MM/YYYY"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); setActiveQuick(""); }} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] text-[#64748b]">קטגוריה</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-[38px] min-w-[160px] rounded-lg border border-[#e2e8f0] px-3 text-[13px] text-[#1a202c] outline-none focus:border-[#1e3a5f] bg-white"
              >
                <option value="">הכל</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Row 2 — quick pills */}
          <div className="flex flex-wrap gap-1.5">
            {QUICK_FILTERS.map((q) => (
              <button
                key={q.key}
                onClick={() => applyQuick(q.key)}
                className={`rounded-lg px-3.5 py-1.5 text-[12px] font-medium transition-colors ${
                  activeQuick === q.key
                    ? "bg-[#1e3a5f] text-white"
                    : "bg-white border border-[#e2e8f0] text-[#64748b] hover:text-[#1a202c]"
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>

          {/* Row 3 — summary */}
          <div className="text-[12px] text-[#64748b]">
            {isLoading ? "טוען..." : `נמצאו ${filteredInvoices.length} חשבוניות | סה״כ ₪${fmtILS(totalSum)}`}
          </div>
        </div>
      </div>

      {/* Export Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Excel */}
        <div className={cardStyle} onClick={exportXLSX}>
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 rounded-xl bg-[#dcfce7] flex items-center justify-center">
              <FileSpreadsheet size={24} className="text-[#16a34a]" />
            </div>
          </div>
          <h3 className="text-[15px] font-bold text-[#1a202c] mb-1">ייצוא Excel</h3>
          <p className="text-[12px] text-[#64748b]">קובץ XLSX מעוצב עם כל העמודות</p>
        </div>

        {/* PDF */}
        <div className={cardStyle} onClick={exportPDF}>
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 rounded-xl bg-[#fee2e2] flex items-center justify-center">
              <FileText size={24} className="text-[#dc2626]" />
            </div>
          </div>
          <h3 className="text-[15px] font-bold text-[#1a202c] mb-1">דוח PDF</h3>
          <p className="text-[12px] text-[#64748b]">דוח הוצאות מקצועי להדפסה</p>
        </div>

        {/* CSV */}
        <div className={cardStyle} onClick={exportCSV}>
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 rounded-xl bg-[#dbeafe] flex items-center justify-center">
              <FileDown size={24} className="text-[#0284c7]" />
            </div>
          </div>
          <h3 className="text-[15px] font-bold text-[#1a202c] mb-1">ייצוא CSV</h3>
          <p className="text-[12px] text-[#64748b]">קובץ CSV תואם לתוכנות הנהלת חשבונות</p>
        </div>
      </div>
    </div>
  );
}
