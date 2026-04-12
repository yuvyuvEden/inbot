import { useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useClientRecord } from "@/hooks/useClientData";
import { Search, ExternalLink, X, ChevronLeft, ChevronRight, FileText, Pencil, Trash2, Download } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  "ציוד משרדי", "שכירות", "ניהול ואחזקה", "ניקיון והיגיינה", "תיקונים ושיפוצים",
  "ריהוט וציוד קבוע", "ארנונה ואגרות", "חשמל", "מים", "ביטוח עסקי", "ביטוח פנסיוני",
  "ביטוח לאומי", "מס הכנסה ומע\"מ", "מחשוב ותוכנה", "שירותי ענן", "דומיינים ואחסון",
  "פיתוח אתרים", "תקשורת", "מינויים (SaaS)", "דלק", "חניה", "תחזוקת רכב", "ביטוח רכב",
  "אגרות כביש", "מוניות", "תחבורה ציבורית", "פרסום ושיווק", "שירותי תוכן",
  "כנסים ואירועים", "הכשרה והשתלמויות", "ייעוץ משפטי", "שירותי הנהלת חשבונות",
  "עמלות בנק", "עמלות סליקה", "ריבית ומימון", "כיבוד למשרד", "ארוחות ומסעדות",
  "מתנות ורווחה", "תרומות", "אחר",
];

const QUICK_FILTERS = [
  { key: "this_month", label: "החודש" },
  { key: "last_month", label: "חודש קודם" },
  { key: "this_quarter", label: "רבעון" },
  { key: "all", label: "הכל" },
];

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
  const now = new Date();
  const y = now.getFullYear(), mo = now.getMonth();
  switch (qf) {
    case "this_month":
      return parsed.getFullYear() === y && parsed.getMonth() === mo;
    case "last_month": {
      const lm = mo === 0 ? 11 : mo - 1;
      const ly = mo === 0 ? y - 1 : y;
      return parsed.getFullYear() === ly && parsed.getMonth() === lm;
    }
    case "this_quarter": {
      const qs = Math.floor(mo / 3) * 3;
      return parsed.getFullYear() === y && parsed.getMonth() >= qs && parsed.getMonth() <= qs + 2;
    }
    default: return true;
  }
}

const PAGE_SIZE = 20;

interface Invoice {
  id: string;
  invoice_date: string | null;
  vendor: string | null;
  invoice_number: string | null;
  total: number | null;
  vat_original: number | null;
  vat_deductible: number | null;
  category: string | null;
  document_type: string | null;
  status: string;
  drive_file_url: string | null;
}

function getCatColor(cat: string | null) {
  if (!cat) return DEFAULT_CAT_COLOR;
  return CATEGORY_COLORS[cat] || DEFAULT_CAT_COLOR;
}

export default function InvoicesTab() {
  const { data: client } = useClientRecord();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [docTypeFilter, setDocTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState(""); // YYYY-MM-DD
  const [dateTo, setDateTo] = useState("");     // YYYY-MM-DD
  const [quickFilter, setQuickFilter] = useState("all");
  const [page, setPage] = useState(0);

  const dateFromRef = useRef<HTMLInputElement>(null);
  const dateToRef = useRef<HTMLInputElement>(null);

  const [editModal, setEditModal] = useState<Invoice | null>(null);
  const [editCatValue, setEditCatValue] = useState("");
  const [deleteModal, setDeleteModal] = useState<Invoice | null>(null);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["all-invoices", client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_date, vendor, invoice_number, total, vat_original, vat_deductible, category, document_type, status, drive_file_url")
        .eq("client_id", client!.id)
        .eq("is_archived", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Invoice[];
    },
  });

  const categories = useMemo(() => {
    if (!invoices) return [];
    const cats = new Set(invoices.map((i) => i.category).filter(Boolean) as string[]);
    return Array.from(cats).sort();
  }, [invoices]);

  const filtered = useMemo(() => {
    if (!invoices) return [];
    return invoices.filter((inv) => {
      if (search) {
        const s = search.toLowerCase();
        const matchVendor = (inv.vendor || "").toLowerCase().includes(s);
        const matchNumber = (inv.invoice_number || "").toLowerCase().includes(s);
        const matchAmount = inv.total != null && inv.total.toString().includes(s);
        if (!matchVendor && !matchNumber && !matchAmount) return false;
      }
      if (categoryFilter && inv.category !== categoryFilter) return false;
      if (docTypeFilter && inv.document_type !== docTypeFilter) return false;
      if (statusFilter && inv.status !== statusFilter) return false;
      if (quickFilter && quickFilter !== "all") {
        if (!matchesQuickFilter(inv.invoice_date, quickFilter)) return false;
      }
      // Date range filtering (dateFrom/dateTo are YYYY-MM-DD)
      if (dateFrom || dateTo) {
        const parsed = parseDMY(inv.invoice_date);
        if (!parsed) return false;
        if (dateFrom) {
          const from = new Date(dateFrom);
          if (parsed < from) return false;
        }
        if (dateTo) {
          const to = new Date(dateTo + "T23:59:59");
          if (parsed > to) return false;
        }
      }
      return true;
    });
  }, [invoices, search, categoryFilter, docTypeFilter, statusFilter, quickFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalAmount = filtered.reduce((s, i) => s + (i.total || 0), 0);

  const resetFilters = () => {
    setSearch(""); setCategoryFilter(""); setDocTypeFilter(""); setStatusFilter("");
    setDateFrom(""); setDateTo(""); setQuickFilter("all"); setPage(0);
  };

  const updateCategory = async () => {
    if (!editModal) return;
    const { error } = await supabase
      .from("invoices")
      .update({ category: editCatValue })
      .eq("id", editModal.id);
    if (error) {
      toast.error("שגיאה בעדכון קטגוריה");
    } else {
      toast.success("הקטגוריה עודכנה");
      queryClient.invalidateQueries({ queryKey: ["all-invoices"] });
    }
    setEditModal(null);
  };

  const deleteInvoice = async () => {
    if (!deleteModal) return;
    const { error } = await supabase
      .from("invoices")
      .delete()
      .eq("id", deleteModal.id);
    if (error) {
      toast.error("שגיאה במחיקת חשבונית");
    } else {
      toast.success("החשבונית נמחקה");
      queryClient.invalidateQueries({ queryKey: ["all-invoices"] });
    }
    setDeleteModal(null);
  };

  const exportCSV = () => {
    if (!filtered.length) return;
    const headers = ["תאריך", "ספק", "מספר חשבונית", "סכום", "מע״מ בפועל", "מע״מ מוכר", "קטגוריה", "סוג", "סטטוס"];
    const rows = filtered.map((inv) => [
      inv.invoice_date || "", inv.vendor || "", inv.invoice_number || "",
      inv.total ?? "", inv.vat_original ?? "", inv.vat_deductible ?? "",
      inv.category || "", inv.document_type || "", STATUS_MAP[inv.status]?.label || inv.status,
    ]);
    const bom = "\uFEFF";
    const csv = bom + [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "invoices.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const selectClass = "h-[38px] shrink-0 min-w-[120px] rounded-lg border border-border bg-card px-3 text-[13px] text-foreground outline-none focus:ring-1 focus:ring-primary";
  const dateClass = "h-[38px] w-[130px] shrink-0 rounded-lg border border-border bg-card px-3 text-[13px] text-foreground outline-none focus:ring-1 focus:ring-primary cursor-pointer";

  return (
    <div className="space-y-0 p-6">
      {/* Filters Bar — single row, no wrapping */}
      <div
        className="flex items-center gap-2 rounded-xl bg-card p-3 shadow-[0_4px_12px_rgba(0,0,0,.08)]"
        style={{ flexWrap: "nowrap", overflowX: "auto" }}
      >
        {/* Search */}
        <div className="relative shrink min-w-[180px] flex-1">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            placeholder="חיפוש לפי ספק, מספר חשבונית, סכום..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="h-[38px] w-full rounded-lg border border-border bg-card pr-9 pl-3 text-[13px] text-foreground outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Category */}
        <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }} className={selectClass}>
          <option value="">קטגוריה: הכל</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Doc Type */}
        <select value={docTypeFilter} onChange={(e) => { setDocTypeFilter(e.target.value); setPage(0); }} className={selectClass}>
          {DOC_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {/* Status */}
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} className={selectClass}>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {/* Date From */}
        <input
          ref={dateFromRef}
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setQuickFilter(""); setPage(0); }}
          onClick={() => dateFromRef.current?.showPicker?.()}
          className={dateClass}
          title="מ-תאריך"
        />
        <span className="shrink-0 text-[12px] text-muted-foreground">עד</span>
        <input
          ref={dateToRef}
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setQuickFilter(""); setPage(0); }}
          onClick={() => dateToRef.current?.showPicker?.()}
          className={dateClass}
          title="עד-תאריך"
        />

        {/* Spacer */}
        <div className="flex-1 min-w-[8px] shrink" />

        {/* Quick Filters */}
        <div className="flex shrink-0 gap-1">
          {QUICK_FILTERS.map((qf) => (
            <button
              key={qf.key}
              onClick={() => { setQuickFilter(qf.key); setDateFrom(""); setDateTo(""); setPage(0); }}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${
                quickFilter === qf.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {qf.label}
            </button>
          ))}
        </div>

        {/* CSV Export */}
        <button onClick={exportCSV} className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors">
          <Download size={12} />
          CSV
        </button>

        {/* Clear */}
        <button onClick={resetFilters} className="flex shrink-0 items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors">
          <X size={12} />
          נקה
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="mt-4 space-y-2">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      ) : paged.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-xl bg-card py-20 shadow-[0_4px_12px_rgba(0,0,0,.08)]">
          <FileText size={40} strokeWidth={1.5} className="text-muted-foreground" />
          <p className="text-muted-foreground font-medium">לא נמצאו חשבוניות</p>
          <p className="text-[13px] text-muted-foreground">נסה לשנות את הפילטרים</p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl bg-card shadow-[0_4px_12px_rgba(0,0,0,.08)]">
          <table className="w-full text-[13px]" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: 100 }} />
              {/* ספק — flexible */}
              <col />
              <col style={{ width: 130 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 90 }} />
            </colgroup>
            <thead>
              <tr className="bg-[#f8fafc] text-[12px] font-bold uppercase text-muted-foreground">
                <th className="px-3 py-3 text-right">תאריך</th>
                <th className="px-3 py-3 text-right">ספק</th>
                <th className="px-3 py-3 text-right">מספר חשבונית</th>
                <th className="px-3 py-3 text-left" style={{ fontVariantNumeric: "tabular-nums" }}>סכום</th>
                <th className="px-3 py-3 text-left">מע״מ בפועל</th>
                <th className="px-3 py-3 text-left">מע״מ מוכר</th>
                <th className="px-3 py-3 text-right">קטגוריה</th>
                <th className="px-3 py-3 text-right">סוג</th>
                <th className="px-3 py-3 text-right">סטטוס</th>
                <th className="px-3 py-3 text-center">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((inv) => {
                const st = STATUS_MAP[inv.status] || STATUS_MAP.pending_review;
                const catColor = getCatColor(inv.category);
                return (
                  <tr key={inv.id} className="border-b border-border/50 transition-colors hover:bg-[#f8fafc]">
                    <td className="px-3 py-3 truncate">{inv.invoice_date || "—"}</td>
                    <td className="px-3 py-3 truncate">{inv.vendor || "—"}</td>
                    <td className="px-3 py-3 truncate">{inv.invoice_number || "—"}</td>
                    <td className="px-3 py-3 text-left font-mono truncate">{inv.total != null ? `₪${inv.total.toLocaleString("he-IL")}` : "—"}</td>
                    <td className="px-3 py-3 text-left font-mono truncate">{inv.vat_original != null ? `₪${inv.vat_original.toLocaleString("he-IL")}` : "—"}</td>
                    <td className="px-3 py-3 text-left font-mono truncate">{inv.vat_deductible != null ? `₪${inv.vat_deductible.toLocaleString("he-IL")}` : "—"}</td>
                    <td className="px-3 py-3">
                      <span
                        className="inline-block max-w-full truncate rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                        style={{ backgroundColor: catColor.bg, color: catColor.text }}
                      >
                        {inv.category || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[12px] truncate">{inv.document_type || "—"}</td>
                    <td className="px-3 py-3">
                      <span className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: st.bg, color: st.text }}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {inv.drive_file_url ? (
                          <a href={inv.drive_file_url} target="_blank" rel="noopener noreferrer" className="text-red-500 hover:text-red-700 transition-colors">
                            <ExternalLink size={15} />
                          </a>
                        ) : (
                          <span className="text-muted-foreground/30"><ExternalLink size={15} /></span>
                        )}
                        <button
                          onClick={() => { setEditModal(inv); setEditCatValue(inv.category || ALL_CATEGORIES[0]); }}
                          className="text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteModal(inv)}
                          className="text-muted-foreground hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      {!isLoading && filtered.length > 0 && (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-card px-5 py-3 text-[13px] shadow-[0_4px_12px_rgba(0,0,0,.08)]">
          <div className="text-muted-foreground">
            {filtered.length} חשבוניות | סה״כ: <span className="font-bold text-foreground">₪{totalAmount.toLocaleString("he-IL", { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))} disabled={page >= totalPages - 1} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
              <ChevronRight size={16} />
            </button>
            <span className="text-muted-foreground">עמוד {page + 1} מתוך {totalPages}</span>
            <button onClick={() => setPage((p) => Math.max(p - 1, 0))} disabled={page <= 0} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
              <ChevronLeft size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      <Dialog open={!!editModal} onOpenChange={(open) => !open && setEditModal(null)}>
        <DialogContent className="max-w-[400px] rounded-2xl p-8" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold" style={{ color: "#1e3a5f" }}>
              עריכת קטגוריה — {editModal?.vendor || ""}
            </DialogTitle>
          </DialogHeader>
          <select
            value={editCatValue}
            onChange={(e) => setEditCatValue(e.target.value)}
            className="mt-4 w-full rounded-lg border border-border bg-card px-3 py-2 text-[14px] outline-none focus:ring-1 focus:ring-primary"
          >
            {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="mt-6 flex justify-end gap-2">
            <button
              onClick={() => setEditModal(null)}
              className="rounded-lg border border-border bg-white px-4 py-2 text-[13px] font-medium text-foreground hover:bg-muted transition-colors"
            >
              ביטול
            </button>
            <button
              onClick={updateCategory}
              className="rounded-lg px-4 py-2 text-[13px] font-medium text-white transition-colors"
              style={{ backgroundColor: "#1e3a5f" }}
            >
              שמור
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deleteModal} onOpenChange={(open) => !open && setDeleteModal(null)}>
        <DialogContent className="max-w-[400px] rounded-2xl p-8" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold" style={{ color: "#1e3a5f" }}>
              מחיקת חשבונית
            </DialogTitle>
          </DialogHeader>
          <p className="mt-4 text-[14px] text-muted-foreground leading-relaxed">
            האם אתה בטוח שברצונך למחוק את החשבונית של <strong className="text-foreground">{deleteModal?.vendor}</strong>? פעולה זו אינה הפיכה.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button
              onClick={() => setDeleteModal(null)}
              className="rounded-lg border border-border bg-white px-4 py-2 text-[13px] font-medium text-foreground hover:bg-muted transition-colors"
            >
              ביטול
            </button>
            <button
              onClick={deleteInvoice}
              className="rounded-lg px-4 py-2 text-[13px] font-medium text-white transition-colors"
              style={{ backgroundColor: "#dc2626" }}
            >
              מחק
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
