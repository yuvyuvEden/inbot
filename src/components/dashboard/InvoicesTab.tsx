import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useClientRecord } from "@/hooks/useClientData";
import { Search, ExternalLink, X, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "", label: "הכל" },
  { value: "approved", label: "מאושר" },
  { value: "pending_review", label: "ממתין לבדיקה" },
  { value: "needs_clarification", label: "דרוש הבהרה" },
];

const DOC_TYPE_OPTIONS = [
  { value: "", label: "הכל" },
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

export default function InvoicesTab() {
  const { data: client } = useClientRecord();
  const queryClient = useQueryClient();

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [docTypeFilter, setDocTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [quickFilter, setQuickFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);

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
      if (search && !(inv.vendor || "").includes(search)) return false;
      if (categoryFilter && inv.category !== categoryFilter) return false;
      if (docTypeFilter && inv.document_type !== docTypeFilter) return false;
      if (statusFilter && inv.status !== statusFilter) return false;
      if (!matchesQuickFilter(inv.invoice_date, quickFilter)) return false;
      if (dateFrom) {
        const d = parseDMY(inv.invoice_date);
        if (!d || d < new Date(dateFrom)) return false;
      }
      if (dateTo) {
        const d = parseDMY(inv.invoice_date);
        if (!d || d > new Date(dateTo + "T23:59:59")) return false;
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

  const updateCategory = async (invoiceId: string, newCategory: string) => {
    const { error } = await supabase
      .from("invoices")
      .update({ category: newCategory })
      .eq("id", invoiceId);
    if (error) {
      toast.error("שגיאה בעדכון קטגוריה");
    } else {
      toast.success("הקטגוריה עודכנה");
      queryClient.invalidateQueries({ queryKey: ["all-invoices"] });
    }
    setEditingCategory(null);
  };

  const selectClass = "h-9 rounded-lg border border-border bg-card px-3 text-[13px] text-foreground outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="space-y-0">
      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-card p-4 shadow-[0_4px_12px_rgba(0,0,0,.08)]">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="חיפוש לפי ספק..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="h-9 w-[220px] rounded-lg border-border pr-9 text-[13px]"
          />
        </div>

        {/* Category */}
        <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }} className={selectClass}>
          <option value="">קטגוריה: הכל</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Doc Type */}
        <select value={docTypeFilter} onChange={(e) => { setDocTypeFilter(e.target.value); setPage(0); }} className={selectClass}>
          {DOC_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.value ? o.label : "סוג מסמך: הכל"}</option>)}
        </select>

        {/* Status */}
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} className={selectClass}>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.value ? o.label : "סטטוס: הכל"}</option>)}
        </select>

        {/* Date Range */}
        <div className="flex items-center gap-1.5">
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setQuickFilter(""); setPage(0); }} className={`${selectClass} w-[130px]`} />
          <span className="text-[12px] text-muted-foreground">עד</span>
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setQuickFilter(""); setPage(0); }} className={`${selectClass} w-[130px]`} />
        </div>

        {/* Quick Filters */}
        <div className="flex gap-1">
          {QUICK_FILTERS.map((qf) => (
            <button
              key={qf.key}
              onClick={() => { setQuickFilter(qf.key); setDateFrom(""); setDateTo(""); setPage(0); }}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${
                quickFilter === qf.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {qf.label}
            </button>
          ))}
        </div>

        {/* Clear */}
        <button onClick={resetFilters} className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors">
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
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[#f8fafc] text-[12px] font-bold uppercase text-muted-foreground">
                <th className="px-4 py-3 text-right">תאריך</th>
                <th className="px-4 py-3 text-right">ספק</th>
                <th className="px-4 py-3 text-right">מספר חשבונית</th>
                <th className="px-4 py-3 text-left" style={{ fontVariantNumeric: "tabular-nums" }}>סכום</th>
                <th className="px-4 py-3 text-left">מע״מ בפועל</th>
                <th className="px-4 py-3 text-left">מע״מ מוכר</th>
                <th className="px-4 py-3 text-right">קטגוריה</th>
                <th className="px-4 py-3 text-right">סוג</th>
                <th className="px-4 py-3 text-right">סטטוס</th>
                <th className="px-4 py-3 text-center">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((inv) => {
                const st = STATUS_MAP[inv.status] || STATUS_MAP.pending_review;
                return (
                  <tr key={inv.id} className="border-b border-border/50 transition-colors hover:bg-[#f8fafc]">
                    <td className="px-4 py-3">{inv.invoice_date || "—"}</td>
                    <td className="px-4 py-3">{inv.vendor || "—"}</td>
                    <td className="px-4 py-3">{inv.invoice_number || "—"}</td>
                    <td className="px-4 py-3 text-left font-mono">{inv.total != null ? `₪${inv.total.toLocaleString("he-IL")}` : "—"}</td>
                    <td className="px-4 py-3 text-left font-mono">{inv.vat_original != null ? `₪${inv.vat_original.toLocaleString("he-IL")}` : "—"}</td>
                    <td className="px-4 py-3 text-left font-mono">{inv.vat_deductible != null ? `₪${inv.vat_deductible.toLocaleString("he-IL")}` : "—"}</td>
                    <td className="px-4 py-3">
                      {editingCategory === inv.id ? (
                        <select
                          autoFocus
                          defaultValue={inv.category || ""}
                          onBlur={() => setEditingCategory(null)}
                          onChange={(e) => updateCategory(inv.id, e.target.value)}
                          className="h-7 rounded border border-primary bg-card px-1 text-[12px] outline-none"
                        >
                          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                          <option value="אחר">אחר</option>
                        </select>
                      ) : (
                        <button
                          onClick={() => setEditingCategory(inv.id)}
                          className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-foreground hover:bg-primary/10 transition-colors"
                        >
                          {inv.category || "—"}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12px]">{inv.document_type || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: st.bg, color: st.text }}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {inv.drive_file_url ? (
                        <a href={inv.drive_file_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                          <ExternalLink size={15} />
                        </a>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
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
    </div>
  );
}
