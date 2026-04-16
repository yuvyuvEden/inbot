import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, ExternalLink, X, ChevronLeft, ChevronRight, FileText, Pencil, Trash2, Download, CalendarIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const STATUS_OPTIONS = [
  { value: "", label: "סטטוס: הכל" },
  { value: "approved", label: "מאושר" },
  { value: "pending_review", label: "ממתין לבדיקה" },
  { value: "needs_clarification", label: "דרוש הבהרה" },
];
const DOC_TYPE_OPTIONS = [
  { value: "", label: "סוג מסמך: הכל" },
  { value: "חשבונית מס", label: "חשבונית מס" },
  { value: "חשבונית מס קבלה", label: "חשבונית מס קבלה" },
  { value: "קבלה", label: "קבלה" },
  { value: "חשבונית זיכוי", label: "חשבונית זיכוי" },
];
const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  approved: { label: "מאושר", bg: "#dcfce7", text: "#16a34a" },
  pending_review: { label: "ממתין לבדיקה", bg: "#fff7ed", text: "#ea580c" },
  needs_clarification: { label: "דרוש הבהרה", bg: "#fef2f2", text: "#dc2626" },
  archived: { label: "בארכיון", bg: "#f1f5f9", text: "#64748b" },
};
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "תקשורת": { bg: "#dbeafe", text: "#1d4ed8" },
  "דלק": { bg: "#fef3c7", text: "#b45309" },
  "ציוד משרדי": { bg: "#f1f5f9", text: "#475569" },
  "מחשוב ותוכנה": { bg: "#ede9fe", text: "#6d28d9" },
  "שירותי ענן": { bg: "#ede9fe", text: "#6d28d9" },
  "מינויים (SaaS)": { bg: "#ede9fe", text: "#6d28d9" },
  "שכירות": { bg: "#fce7f3", text: "#9d174d" },
  "חשמל": { bg: "#fef9c3", text: "#854d0e" },
  "ביטוח עסקי": { bg: "#d1fae5", text: "#065f46" },
  "ביטוח רכב": { bg: "#d1fae5", text: "#065f46" },
  "ביטוח פנסיוני": { bg: "#d1fae5", text: "#065f46" },
  "תחזוקת רכב": { bg: "#ffedd5", text: "#9a3412" },
  "מוניות": { bg: "#ffedd5", text: "#9a3412" },
  "חניה": { bg: "#ffedd5", text: "#9a3412" },
  "ארוחות ומסעדות": { bg: "#fee2e2", text: "#991b1b" },
  "כיבוד למשרד": { bg: "#fee2e2", text: "#991b1b" },
  "פרסום ושיווק": { bg: "#fae8ff", text: "#7e22ce" },
  "ייעוץ משפטי": { bg: "#f0fdf4", text: "#15803d" },
  "שירותי הנהלת חשבונות": { bg: "#f0fdf4", text: "#15803d" },
  "עמלות בנק": { bg: "#f8fafc", text: "#334155" },
  "עמלות סליקה": { bg: "#e2e8f0", text: "#1e293b" },
};
const DEFAULT_CAT_COLOR = { bg: "#f1f5f9", text: "#64748b" };
const ALL_CATEGORIES = [
  "ציוד משרדי","שכירות","ניהול ואחזקה","ניקיון והיגיינה","תיקונים ושיפוצים",
  "ריהוט וציוד קבוע","ארנונה ואגרות","חשמל","מים","ביטוח עסקי","ביטוח פנסיוני",
  "ביטוח לאומי","מס הכנסה ומע\"מ","מחשוב ותוכנה","שירותי ענן","דומיינים ואחסון",
  "פיתוח אתרים","תקשורת","מינויים (SaaS)","דלק","חניה","תחזוקת רכב","ביטוח רכב",
  "אגרות כביש","מוניות","תחבורה ציבורית","פרסום ושיווק","שירותי תוכן",
  "כנסים ואירועים","הכשרה והשתלמויות","ייעוץ משפטי","שירותי הנהלת חשבונות",
  "עמלות בנק","עמלות סליקה","ריבית ומימון","כיבוד למשרד","ארוחות ומסעדות",
  "מתנות ורווחה","תרומות","אחר",
];
const QUICK_FILTERS = [
  { key: "this_month", label: "החודש" },
  { key: "last_month", label: "חודש קודם" },
  { key: "this_quarter", label: "רבעון" },
  { key: "all", label: "הכל" },
];

/** Auto-format typed digits into dd/mm/yyyy */
function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return digits.slice(0, 2) + "/" + digits.slice(2);
  return digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4);
}

function parseDMY(d: string | null): Date | null {
  if (!d) return null;
  const m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
}
function matchesQuickFilter(dateStr: string | null, qf: string): boolean {
  if (qf === "all" || !qf) return true;
  const parsed = parseDMY(dateStr);
  if (!parsed) return false;
  const now = new Date(), y = now.getFullYear(), mo = now.getMonth();
  switch (qf) {
    case "this_month": return parsed.getFullYear() === y && parsed.getMonth() === mo;
    case "last_month": { const lm = mo === 0 ? 11 : mo - 1, ly = mo === 0 ? y - 1 : y; return parsed.getFullYear() === ly && parsed.getMonth() === lm; }
    case "this_quarter": { const qs = Math.floor(mo / 3) * 3; return parsed.getFullYear() === y && parsed.getMonth() >= qs && parsed.getMonth() <= qs + 2; }
    default: return true;
  }
}
function getCatColor(cat: string | null) { return cat ? (CATEGORY_COLORS[cat] || DEFAULT_CAT_COLOR) : DEFAULT_CAT_COLOR; }

const PAGE_SIZE = 20;
interface Invoice { id: string; invoice_date: string | null; vendor: string | null; invoice_number: string | null; total: number | null; vat_original: number | null; vat_deductible: number | null; category: string | null; document_type: string | null; status: string; drive_file_url: string | null; }

interface Props { clientId?: string; }

/* ─── Component ─── */
export default function InvoicesTab({ clientId }: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [docTypeFilter, setDocTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [quickFilter, setQuickFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [editPickerModal, setEditPickerModal] = useState<Invoice | null>(null);
  const [editModal, setEditModal] = useState<Invoice | null>(null);
  const [editCatValue, setEditCatValue] = useState("");
  const [editVendorModal, setEditVendorModal] = useState<Invoice | null>(null);
  const [editVendorValue, setEditVendorValue] = useState("");
  const [deleteModal, setDeleteModal] = useState<Invoice | null>(null);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["all-invoices", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices")
        .select("id, invoice_date, vendor, invoice_number, total, vat_original, vat_deductible, category, document_type, status, drive_file_url")
        .eq("client_id", clientId!).eq("is_archived", false);
      if (error) throw error;
      const rows = (data || []) as Invoice[];
      // Sort client-side because invoice_date is DD/MM/YYYY text
      rows.sort((a, b) => {
        if (!a.invoice_date && !b.invoice_date) return 0;
        if (!a.invoice_date) return 1;
        if (!b.invoice_date) return -1;
        const [da, ma, ya] = a.invoice_date.split("/").map(Number);
        const [db, mb, yb] = b.invoice_date.split("/").map(Number);
        return (yb * 10000 + mb * 100 + db) - (ya * 10000 + ma * 100 + da);
      });
      return rows;
    },
  });

  const categories = useMemo(() => {
    if (!invoices) return [];
    return Array.from(new Set(invoices.map(i => i.category).filter(Boolean) as string[])).sort();
  }, [invoices]);

  const filtered = useMemo(() => {
    if (!invoices) return [];
    return invoices.filter(inv => {
      if (search) {
        const s = search.toLowerCase();
        if (!(inv.vendor || "").toLowerCase().includes(s) && !(inv.invoice_number || "").toLowerCase().includes(s) && !(inv.total != null && inv.total.toString().includes(s))) return false;
      }
      if (categoryFilter && inv.category !== categoryFilter) return false;
      if (docTypeFilter && inv.document_type !== docTypeFilter) return false;
      if (statusFilter && inv.status !== statusFilter) return false;
      if (quickFilter && quickFilter !== "all" && !matchesQuickFilter(inv.invoice_date, quickFilter)) return false;
      if (dateFrom || dateTo) {
        const parsed = parseDMY(inv.invoice_date);
        if (!parsed) return false;
        if (dateFrom && parsed < dateFrom) return false;
        if (dateTo) { const end = new Date(dateTo); end.setHours(23, 59, 59); if (parsed > end) return false; }
      }
      return true;
    });
  }, [invoices, search, categoryFilter, docTypeFilter, statusFilter, quickFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalAmount = filtered.reduce((s, i) => s + (i.total || 0), 0);
  const resetFilters = () => { setSearch(""); setCategoryFilter(""); setDocTypeFilter(""); setStatusFilter(""); setDateFrom(undefined); setDateTo(undefined); setQuickFilter("all"); setPage(0); };

  const updateCategory = async () => {
    if (!editModal) return;
    const { error } = await supabase.from("invoices").update({ category: editCatValue }).eq("id", editModal.id);
    if (error) toast.error("שגיאה בעדכון קטגוריה"); else { toast.success("הקטגוריה עודכנה"); queryClient.invalidateQueries({ queryKey: ["all-invoices"] }); }
    setEditModal(null);
  };
  const updateVendor = async () => {
    if (!editVendorModal) return;
    const { error } = await supabase.from("invoices").update({ vendor: editVendorValue }).eq("id", editVendorModal.id);
    if (error) toast.error("שגיאה בעדכון שם עסק"); else { toast.success("שם העסק עודכן"); queryClient.invalidateQueries({ queryKey: ["all-invoices"] }); }
    setEditVendorModal(null);
  };
  const deleteInvoice = async () => {
    if (!deleteModal) return;
    const { error } = await supabase.from("invoices").delete().eq("id", deleteModal.id);
    if (error) toast.error("שגיאה במחיקת חשבונית"); else { toast.success("החשבונית נמחקה"); queryClient.invalidateQueries({ queryKey: ["all-invoices"] }); }
    setDeleteModal(null);
  };
  const exportCSV = () => {
    if (!filtered.length) return;
    const headers = ["תאריך","ספק","מספר חשבונית","סכום","מע״מ בפועל","מע״מ מוכר","קטגוריה","סוג","סטטוס"];
    const rows = filtered.map(inv => [inv.invoice_date||"",inv.vendor||"",inv.invoice_number||"",inv.total??"",inv.vat_original??"",inv.vat_deductible??"",inv.category||"",inv.document_type||"",STATUS_MAP[inv.status]?.label||inv.status]);
    const csv = "\uFEFF" + [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "invoices.csv"; a.click(); URL.revokeObjectURL(url);
  };

  const sel = "h-[36px] shrink-0 rounded-md border border-[#e2e8f0] bg-white px-2 text-[13px] outline-none focus:ring-1 focus:ring-primary";
  const dateCls = "h-[36px] w-[130px] shrink-0 rounded-md border border-[#e2e8f0] bg-white px-2 text-[13px] outline-none focus:ring-1 focus:ring-primary cursor-pointer";

  const renderActions = (inv: Invoice) => (
    <div className="flex items-center justify-center gap-1">
      {inv.drive_file_url ? (
        <a href={inv.drive_file_url} target="_blank" rel="noopener noreferrer"
          style={{ color: '#dc2626', background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#fee2e2')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        ><ExternalLink size={16} /></a>
      ) : (
        <span style={{ color: '#dc2626', opacity: 0.3, padding: '6px', borderRadius: '6px' }}><ExternalLink size={16} /></span>
      )}
      <button onClick={() => setEditPickerModal(inv)}
        style={{ color: '#1e3a5f', background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
      ><Pencil size={16} /></button>
      <button onClick={() => setDeleteModal(inv)}
        style={{ color: '#dc2626', background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#fee2e2')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
      ><Trash2 size={16} /></button>
    </div>
  );

  return (
    <div className="flex flex-col">
      {/* ── Filters ── */}
      <div className="bg-white border-b border-[#e2e8f0] px-6 py-3">
        {/* Mobile: search on top */}
        <div className="md:hidden mb-2">
          <div className="relative">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input placeholder="חיפוש לפי ספק, מספר חשבונית..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="h-[36px] w-full rounded-md border border-[#e2e8f0] bg-white pr-9 pl-3 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
          </div>
        </div>
        <div className="flex items-center gap-2" style={{ flexWrap: "nowrap", overflowX: "auto" }}>
          {/* Desktop search */}
          <div className="relative hidden md:block shrink min-w-[160px] flex-1">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input placeholder="חיפוש לפי ספק, מספר חשבונית..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="h-[36px] w-full rounded-md border border-[#e2e8f0] bg-white pr-9 pl-3 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(0); }} className={sel}>
            <option value="">קטגוריה: הכל</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={docTypeFilter} onChange={e => { setDocTypeFilter(e.target.value); setPage(0); }} className={sel}>
            {DOC_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }} className={sel}>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("h-[36px] shrink-0 gap-1 text-[12px] font-normal", !dateFrom && "text-muted-foreground")} style={{ minWidth: 120 }}>
                <CalendarIcon size={14} />
                {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "מ-תאריך"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); setQuickFilter(""); setPage(0); }} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          <span className="shrink-0 text-[12px] text-gray-400">עד</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("h-[36px] shrink-0 gap-1 text-[12px] font-normal", !dateTo && "text-muted-foreground")} style={{ minWidth: 120 }}>
                <CalendarIcon size={14} />
                {dateTo ? format(dateTo, "dd/MM/yyyy") : "עד-תאריך"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); setQuickFilter(""); setPage(0); }} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          <span className="shrink-0 text-gray-300 text-[16px]">|</span>
          {QUICK_FILTERS.map(qf => (
            <button key={qf.key} onClick={() => { setQuickFilter(qf.key); setDateFrom(undefined); setDateTo(undefined); setPage(0); }}
              className={`shrink-0 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${quickFilter === qf.key ? "bg-[#1e3a5f] text-white" : "text-gray-500 hover:text-gray-800"}`}>
              {qf.label}
            </button>
          ))}
          <button onClick={exportCSV} className="flex shrink-0 items-center gap-1 rounded-md border border-[#e2e8f0] px-3 py-1.5 text-[12px] font-medium text-gray-500 hover:text-gray-800 transition-colors">
            <Download size={12} /> CSV
          </button>
          <button onClick={resetFilters} className="flex shrink-0 items-center gap-1 text-[12px] text-gray-400 hover:text-gray-700 transition-colors">
            <X size={12} /> נקה
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      {isLoading ? (
        <div className="p-6 space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
      ) : paged.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-20">
          <FileText size={40} strokeWidth={1.5} className="text-gray-300" />
          <p className="text-gray-500 font-medium">לא נמצאו חשבוניות</p>
          <p className="text-[13px] text-gray-400">נסה לשנות את הפילטרים</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block w-full bg-white overflow-visible">
            <table className="w-full text-[13px]" style={{ width: "100%", tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "8%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "9%" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[12px] font-bold text-gray-500">
                  <th className="px-3 py-3 text-right">תאריך</th>
                  <th className="px-3 py-3 text-right">ספק</th>
                  <th className="px-3 py-3 text-right">מספר חשבונית</th>
                  <th className="px-3 py-3 text-left">סכום</th>
                  <th className="px-3 py-3 text-left">מע״מ בפועל</th>
                  <th className="px-3 py-3 text-left">מע״מ מוכר</th>
                  <th className="px-3 py-3 text-right">קטגוריה</th>
                  <th className="px-3 py-3 text-right">סוג</th>
                  <th className="px-3 py-3 text-right">סטטוס</th>
                  <th className="px-3 py-3 text-center">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(inv => {
                  const st = STATUS_MAP[inv.status] || STATUS_MAP.pending_review;
                  const cc = getCatColor(inv.category);
                  return (
                    <tr key={inv.id} className="border-b border-[#e2e8f0]/60 hover:bg-[#f8fafc] transition-colors">
                      <td className="px-3 py-3 whitespace-nowrap">{inv.invoice_date || "—"}</td>
                      <td className="px-3 py-3 truncate" title={inv.vendor || ""}>{inv.vendor || "—"}</td>
                      <td className="px-3 py-3 truncate">{inv.invoice_number || "—"}</td>
                      <td className="px-3 py-3 text-left font-mono tabular-nums whitespace-nowrap">{inv.total != null ? `₪${inv.total.toLocaleString("he-IL")}` : "—"}</td>
                      <td className="px-3 py-3 text-left font-mono tabular-nums whitespace-nowrap">{inv.vat_original != null ? `₪${inv.vat_original.toLocaleString("he-IL")}` : "—"}</td>
                      <td className="px-3 py-3 text-left font-mono tabular-nums whitespace-nowrap">{inv.vat_deductible != null ? `₪${inv.vat_deductible.toLocaleString("he-IL")}` : "—"}</td>
                      <td className="px-3 py-3"><span className="inline-block max-w-full truncate rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: cc.bg, color: cc.text }}>{inv.category || "—"}</span></td>
                      <td className="px-3 py-3 text-[12px] truncate">{inv.document_type || "—"}</td>
                      <td className="px-3 py-3"><span className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span></td>
                      <td className="px-3 py-3">{renderActions(inv)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden px-4 py-3 space-y-2">
            {paged.map(inv => {
              const st = STATUS_MAP[inv.status] || STATUS_MAP.pending_review;
              const cc = getCatColor(inv.category);
              return (
                <div key={inv.id} className="rounded-xl bg-white p-4 shadow-sm border border-[#e2e8f0]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[14px] text-[#1a202c] truncate">{inv.vendor || "—"}</span>
                    <span className="font-bold text-[14px] font-mono">{inv.total != null ? `₪${inv.total.toLocaleString("he-IL")}` : "—"}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[12px] text-gray-400">{inv.invoice_date || "—"}</span>
                    <span className="rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: cc.bg, color: cc.text }}>{inv.category || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[12px] text-gray-400">{inv.document_type || "—"}</span>
                    <span className="rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-[#e2e8f0]">{renderActions(inv)}</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Footer ── */}
      {!isLoading && filtered.length > 0 && (
        <div className="flex items-center justify-between bg-white border-t border-[#e2e8f0] px-6 py-3 text-[13px]">
          <div className="text-gray-500">
            {filtered.length} חשבוניות | סה״כ: <span className="font-bold text-[#1a202c]">₪{totalAmount.toLocaleString("he-IL", { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.min(p + 1, totalPages - 1))} disabled={page >= totalPages - 1} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"><ChevronRight size={16} /></button>
            <span className="text-gray-500">עמוד {page + 1} מתוך {totalPages}</span>
            <button onClick={() => setPage(p => Math.max(p - 1, 0))} disabled={page <= 0} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"><ChevronLeft size={16} /></button>
          </div>
        </div>
      )}

      {/* ── Edit Picker Modal ── */}
      <Dialog open={!!editPickerModal} onOpenChange={open => !open && setEditPickerModal(null)}>
        <DialogContent className="max-w-[360px] rounded-2xl p-8" dir="rtl">
          <DialogHeader><DialogTitle className="text-lg font-bold" style={{ color: "#1e3a5f" }}>עריכה — {editPickerModal?.vendor || ""}</DialogTitle></DialogHeader>
          <p className="mt-2 text-[13px] text-gray-500">מה ברצונך לעדכן?</p>
          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={() => { const inv = editPickerModal!; setEditPickerModal(null); setEditModal(inv); setEditCatValue(inv.category || ALL_CATEGORIES[0]); }}
              className="rounded-lg px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: "#1e3a5f" }}
            >עדכון קטגוריה</button>
            <button
              onClick={() => { const inv = editPickerModal!; setEditPickerModal(null); setEditVendorModal(inv); setEditVendorValue(inv.vendor || ""); }}
              className="rounded-lg px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: "#e8941a" }}
            >עדכון שם עסק</button>
            <button onClick={() => setEditPickerModal(null)} className="rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-[13px] font-medium text-gray-500 hover:bg-gray-50 transition-colors">ביטול</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Category Modal ── */}
      <Dialog open={!!editModal} onOpenChange={open => !open && setEditModal(null)}>
        <DialogContent className="max-w-[400px] rounded-2xl p-8" dir="rtl">
          <DialogHeader><DialogTitle className="text-lg font-bold" style={{ color: "#1e3a5f" }}>עריכת קטגוריה — {editModal?.vendor || ""}</DialogTitle></DialogHeader>
          <select value={editCatValue} onChange={e => setEditCatValue(e.target.value)} className="mt-4 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-[14px] outline-none focus:ring-1 focus:ring-primary">
            {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="mt-6 flex justify-end gap-2">
            <button onClick={() => setEditModal(null)} className="rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-[13px] font-medium hover:bg-gray-50 transition-colors">ביטול</button>
            <button onClick={updateCategory} className="rounded-lg px-4 py-2 text-[13px] font-medium text-white transition-colors" style={{ backgroundColor: "#1e3a5f" }}>שמור</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Vendor Modal ── */}
      <Dialog open={!!editVendorModal} onOpenChange={open => !open && setEditVendorModal(null)}>
        <DialogContent className="max-w-[400px] rounded-2xl p-8" dir="rtl">
          <DialogHeader><DialogTitle className="text-lg font-bold" style={{ color: "#1e3a5f" }}>עריכת שם עסק — {editVendorModal?.vendor || ""}</DialogTitle></DialogHeader>
          <input
            value={editVendorValue}
            onChange={e => setEditVendorValue(e.target.value)}
            className="mt-4 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-[14px] outline-none focus:ring-1 focus:ring-primary"
            style={{ direction: "ltr" }}
            placeholder="שם עסק חדש"
          />
          <div className="mt-6 flex justify-end gap-2">
            <button onClick={() => setEditVendorModal(null)} className="rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-[13px] font-medium hover:bg-gray-50 transition-colors">ביטול</button>
            <button onClick={updateVendor} disabled={!editVendorValue.trim()} className="rounded-lg px-4 py-2 text-[13px] font-medium text-white transition-colors disabled:opacity-50" style={{ backgroundColor: "#1e3a5f" }}>שמור</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Modal ── */}
      <Dialog open={!!deleteModal} onOpenChange={open => !open && setDeleteModal(null)}>
        <DialogContent className="max-w-[400px] rounded-2xl p-8" dir="rtl">
          <DialogHeader><DialogTitle className="text-lg font-bold" style={{ color: "#1e3a5f" }}>מחיקת חשבונית</DialogTitle></DialogHeader>
          <p className="mt-4 text-[14px] text-gray-500 leading-relaxed">האם אתה בטוח שברצונך למחוק את החשבונית של <strong className="text-[#1a202c]">{deleteModal?.vendor}</strong>? פעולה זו אינה הפיכה.</p>
          <div className="mt-6 flex justify-end gap-2">
            <button onClick={() => setDeleteModal(null)} className="rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-[13px] font-medium hover:bg-gray-50 transition-colors">ביטול</button>
            <button onClick={deleteInvoice} className="rounded-lg px-4 py-2 text-[13px] font-medium text-white transition-colors" style={{ backgroundColor: "#dc2626" }}>מחק</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
