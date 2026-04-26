import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, ExternalLink, X, ChevronLeft, ChevronRight, FileText, Pencil, Trash2, Download, CalendarIcon, CheckCircle, MessageSquare, Archive } from "lucide-react";
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
import { optimisticUpdate, ConflictError } from "@/hooks/useOptimisticLock";
import { useVatRules, calcVat } from "@/hooks/useVatRules";

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

/** Format ISO date (YYYY-MM-DD) to DD/MM/YYYY for display */
function formatDate(d: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function parseISODate(d: string | null): Date | null {
  if (!d) return null;
  const dt = new Date(d + "T00:00:00");
  return isNaN(dt.getTime()) ? null : dt;
}
function matchesQuickFilter(dateStr: string | null, qf: string): boolean {
  if (qf === "all" || !qf) return true;
  const parsed = parseISODate(dateStr);
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

const PAGE_SIZE = 50;
interface Invoice { id: string; invoice_date: string | null; vendor: string | null; invoice_number: string | null; total: number | null; vat_original: number | null; vat_deductible: number | null; category: string | null; document_type: string | null; status: string; drive_file_url: string | null; updated_at: string; deleted_at: string | null; }

interface Props { clientId?: string; hasAccountant?: boolean; showAccountantActions?: boolean; isReadOnly?: boolean; }

/* ─── Component ─── */
export default function InvoicesTab({ clientId, hasAccountant = false, showAccountantActions = false, isReadOnly = false }: Props) {
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
  const [editDetailsModal, setEditDetailsModal] = useState<Invoice | null>(null);
  const [editDetailsVendor, setEditDetailsVendor] = useState("");
  const [editDetailsDate, setEditDetailsDate] = useState<Date | undefined>(undefined);
  const [editDetailsTotal, setEditDetailsTotal] = useState("");
  const [deleteModal, setDeleteModal] = useState<Invoice | null>(null);
  const [archiveModal, setArchiveModal] = useState<Invoice | null>(null);
  const [approveModal, setApproveModal] = useState<Invoice | null>(null);
  const [clarifyModal, setClarifyModal] = useState<Invoice | null>(null);
  const [clarifyText, setClarifyText] = useState("");
  const [clarifyLoading, setClarifyLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkApproving, setBulkApproving] = useState(false);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["all-invoices", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices")
        .select("id, invoice_date, vendor, invoice_number, total, vat_original, vat_deductible, category, document_type, status, drive_file_url, archived_at, archived_by, updated_at, deleted_at")
        .eq("client_id", clientId!).eq("is_archived", false).is("deleted_at", null)
        .order("invoice_date", { ascending: false });
      if (error) throw error;
      return (data || []) as Invoice[];
    },
  });

  const { data: vatRules = [] } = useVatRules();


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
        const parsed = parseISODate(inv.invoice_date);
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
  const resetFilters = () => { setSearch(""); setCategoryFilter(""); setDocTypeFilter(""); setStatusFilter(""); setDateFrom(undefined); setDateTo(undefined); setQuickFilter("all"); setPage(0); setSelectedIds(new Set()); };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === paged.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paged.map(inv => inv.id)));
    }
  };
  const bulkApprove = async () => {
    if (selectedIds.size === 0) return;
    setBulkApproving(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase
        .from("invoices")
        .update({ status: "approved" })
        .in("id", ids);
      if (error) throw error;
      toast.success(`${ids.length} חשבוניות אושרו בהצלחה`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["all-invoices"] });
    } catch (e: any) {
      toast.error(e.message || "שגיאה באישור מרובה");
    } finally {
      setBulkApproving(false);
    }
  };

  useEffect(() => { setSelectedIds(new Set()); }, [page, clientId]);

  const updateCategory = async () => {
    if (!editModal) return;
    try {
      await optimisticUpdate("invoices", editModal.id, editModal.updated_at, { category: editCatValue });
      toast.success("הקטגוריה עודכנה");
      queryClient.invalidateQueries({ queryKey: ["all-invoices"] });
      setEditModal(null);
    } catch (e) {
      if (e instanceof ConflictError) {
        toast.error("החשבונית עודכנה על ידי משתמש אחר — מרענן נתונים");
        queryClient.invalidateQueries({ queryKey: ["all-invoices"] });
        setEditModal(null);
      } else {
        toast.error("שגיאה בעדכון קטגוריה");
      }
    }
  };
  const updateVendor = async () => {
    if (!editVendorModal) return;
    try {
      await optimisticUpdate("invoices", editVendorModal.id, editVendorModal.updated_at, { vendor: editVendorValue });
      toast.success("שם העסק עודכן");
      queryClient.invalidateQueries({ queryKey: ["all-invoices"] });
      setEditVendorModal(null);
    } catch (e) {
      if (e instanceof ConflictError) {
        toast.error("החשבונית עודכנה על ידי משתמש אחר — מרענן נתונים");
        queryClient.invalidateQueries({ queryKey: ["all-invoices"] });
        setEditVendorModal(null);
      } else {
        toast.error("שגיאה בעדכון שם עסק");
      }
    }
  };
  const updateDetails = async () => {
    if (!editDetailsModal) return;
    const newTotal = parseFloat(editDetailsTotal.replace(/,/g, ""));
    if (isNaN(newTotal) || newTotal < 0) return;

    const rule = vatRules.find(r => r.category === editDetailsModal.category);
    const { vat_original, vat_deductible } = calcVat(newTotal, rule);

    const invoice_date = editDetailsDate
      ? format(editDetailsDate, "yyyy-MM-dd")
      : editDetailsModal.invoice_date;

    try {
      await optimisticUpdate("invoices", editDetailsModal.id, editDetailsModal.updated_at, {
        vendor: editDetailsVendor.trim() || editDetailsModal.vendor,
        invoice_date,
        total: newTotal,
        vat_original,
        vat_deductible,
      });
      toast.success("פרטי החשבונית עודכנו");
      queryClient.invalidateQueries({ queryKey: ["all-invoices"] });
      setEditDetailsModal(null);
    } catch (e) {
      if (e instanceof ConflictError) {
        toast.error("החשבונית עודכנה על ידי משתמש אחר — מרענן נתונים");
        queryClient.invalidateQueries({ queryKey: ["all-invoices"] });
        setEditDetailsModal(null);
      } else {
        console.error("Failed to update invoice details:", e);
        toast.error("שגיאה בעדכון פרטי חשבונית");
      }
    }
  };
  const deleteInvoice = async () => {
    if (!deleteModal) return;
    const { error } = await supabase
      .from("invoices")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", deleteModal.id);
    if (error) {
      toast.error("שגיאה במחיקת חשבונית");
    } else {
      toast.success("החשבונית נמחקה");
      queryClient.invalidateQueries({ queryKey: ["all-invoices"] });
    }
    setDeleteModal(null);
  };

  const archiveInvoice = async () => {
    if (!archiveModal) return;
    const { error } = await supabase.from("invoices").update({ is_archived: true }).eq("id", archiveModal.id);
    if (error) toast.error("שגיאה בארכוב חשבונית");
    else { toast.success("החשבונית הועברה לארכיון"); queryClient.invalidateQueries({ queryKey: ["all-invoices"] }); }
    setArchiveModal(null);
  };

  const approveInvoice = async () => {
    if (!approveModal) return;
    try {
      await optimisticUpdate("invoices", approveModal.id, approveModal.updated_at, { status: "approved" });
      toast.success("החשבונית אושרה");
      queryClient.invalidateQueries({ queryKey: ["all-invoices"] });
      setApproveModal(null);
    } catch (e) {
      if (e instanceof ConflictError) {
        toast.error("החשבונית עודכנה על ידי משתמש אחר — מרענן נתונים");
        queryClient.invalidateQueries({ queryKey: ["all-invoices"] });
        setApproveModal(null);
      } else {
        toast.error("שגיאה באישור חשבונית");
      }
    }
  };

  const requestClarification = async () => {
    if (!clarifyModal || !clarifyText.trim()) return;
    setClarifyLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accountant-send-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            invoice_id: clarifyModal.id,
            body: clarifyText.trim(),
          }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "שגיאה בשליחה");

      if (result.email_sent) {
        toast.success("בקשת הבהרה נשלחה ומייל נמסר ללקוח");
      } else {
        toast.success("בקשת ההבהרה נשמרה (מייל לא נשלח — Resend לא מוגדר)");
      }
      queryClient.invalidateQueries({ queryKey: ["all-invoices"] });
      setClarifyModal(null);
      setClarifyText("");
    } catch (e: any) {
      toast.error(e.message || "שגיאה בשליחת בקשת הבהרה");
    } finally {
      setClarifyLoading(false);
    }
  };

  const exportCSV = () => {
    if (!filtered.length) return;
    const headers = ["תאריך","ספק","מספר חשבונית","סכום","מע״מ בפועל","מע״מ מוכר","קטגוריה","סוג","סטטוס"];
    const rows = filtered.map(inv => [formatDate(inv.invoice_date),inv.vendor||"",inv.invoice_number||"",inv.total??"",inv.vat_original??"",inv.vat_deductible??"",inv.category||"",inv.document_type||"",STATUS_MAP[inv.status]?.label||inv.status]);
    const csv = "\uFEFF" + [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "invoices.csv"; a.click(); URL.revokeObjectURL(url);
  };

  const sel = "h-[36px] shrink-0 rounded-md border border-[#e2e8f0] bg-white px-2 text-[13px] outline-none focus:ring-1 focus:ring-primary min-w-[120px]";
  const dateCls = "h-[36px] w-[130px] shrink-0 rounded-md border border-[#e2e8f0] bg-white px-2 text-[13px] outline-none focus:ring-1 focus:ring-primary cursor-pointer";

  const renderActions = (inv: Invoice, isAccountantView = false, compact = false) => {
    const iconSize = compact ? 14 : 16;
    const buttonPadding = compact ? '4px' : '6px';

    return (
      <div className={cn("flex items-center justify-center", compact ? "gap-0.5" : "gap-1")}>
        {!isReadOnly && isAccountantView && inv.status !== "approved" && (
          <button onClick={() => setApproveModal(inv)} title="אשר"
            style={{ color: '#16a34a', background: 'transparent', border: 'none', cursor: 'pointer', padding: buttonPadding, borderRadius: '6px' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#dcfce7')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          ><CheckCircle size={iconSize} /></button>
        )}
        {!isReadOnly && isAccountantView && inv.status !== "needs_clarification" && (
          <button onClick={() => { setClarifyModal(inv); setClarifyText(""); }} title="בקש הבהרה"
            style={{ color: '#e8941a', background: 'transparent', border: 'none', cursor: 'pointer', padding: buttonPadding, borderRadius: '6px' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#fef3c7')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          ><MessageSquare size={iconSize} /></button>
        )}
        {!isReadOnly && isAccountantView && (
          <button onClick={() => setArchiveModal(inv)} title="ארכב"
            style={{ color: '#64748b', background: 'transparent', border: 'none', cursor: 'pointer', padding: buttonPadding, borderRadius: '6px' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          ><Archive size={iconSize} /></button>
        )}
        {inv.drive_file_url ? (
          <a href={inv.drive_file_url} target="_blank" rel="noopener noreferrer"
            style={{ color: '#dc2626', background: 'transparent', border: 'none', cursor: 'pointer', padding: buttonPadding, borderRadius: '6px' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#fee2e2')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          ><ExternalLink size={iconSize} /></a>
        ) : (
          <span style={{ color: '#dc2626', opacity: 0.3, padding: buttonPadding, borderRadius: '6px' }}><ExternalLink size={iconSize} /></span>
        )}
        {!isReadOnly && (
          <button onClick={() => setEditPickerModal(inv)}
            style={{ color: '#1e3a5f', background: 'transparent', border: 'none', cursor: 'pointer', padding: buttonPadding, borderRadius: '6px' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          ><Pencil size={iconSize} /></button>
        )}
        {!isReadOnly && (
          <button onClick={() => setDeleteModal(inv)}
            style={{ color: '#dc2626', background: 'transparent', border: 'none', cursor: 'pointer', padding: buttonPadding, borderRadius: '6px' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#fee2e2')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          ><Trash2 size={iconSize} /></button>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col">
      {/* ── Filters ── */}
      <div className="bg-white border-b border-[#e2e8f0] px-4 md:px-6 py-3">
        {/* Mobile: vertical stacked filters */}
        <div
          className="md:hidden"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            marginBottom: "16px",
          }}
        >
          {/* Row 1: search */}
          <div style={{ position: "relative", width: "100%" }}>
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              placeholder="חיפוש לפי ספק, מספר חשבונית..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              style={{ width: "100%", boxSizing: "border-box", fontSize: "13px" }}
              className="h-[36px] rounded-md border border-[#e2e8f0] bg-white pr-9 pl-3 outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Row 2: category + status */}
          <div style={{ display: "flex", gap: "8px" }}>
            <select
              value={categoryFilter}
              onChange={e => { setCategoryFilter(e.target.value); setPage(0); }}
              style={{ width: "50%", boxSizing: "border-box", fontSize: "13px" }}
              className="h-[36px] rounded-md border border-[#e2e8f0] bg-white px-2 outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">קטגוריה: הכל</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {hasAccountant ? (
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
                style={{ width: "50%", boxSizing: "border-box", fontSize: "13px" }}
                className="h-[36px] rounded-md border border-[#e2e8f0] bg-white px-2 outline-none focus:ring-1 focus:ring-primary"
              >
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : <div style={{ width: "50%" }} />}
          </div>

          {/* Row 3: doc type */}
          <select
            value={docTypeFilter}
            onChange={e => { setDocTypeFilter(e.target.value); setPage(0); }}
            style={{ width: "100%", boxSizing: "border-box", fontSize: "13px" }}
            className="h-[36px] rounded-md border border-[#e2e8f0] bg-white px-2 outline-none focus:ring-1 focus:ring-primary"
          >
            {DOC_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* Row 4: date pickers */}
          <div style={{ display: "flex", gap: "8px" }}>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("h-[36px] gap-1 text-[12px] font-normal flex-1", !dateFrom && "text-muted-foreground")} style={{ width: "50%", boxSizing: "border-box" }}>
                  <CalendarIcon size={14} />
                  {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "מ-תאריך"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); setQuickFilter(""); setPage(0); }} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("h-[36px] gap-1 text-[12px] font-normal flex-1", !dateTo && "text-muted-foreground")} style={{ width: "50%", boxSizing: "border-box" }}>
                  <CalendarIcon size={14} />
                  {dateTo ? format(dateTo, "dd/MM/yyyy") : "עד-תאריך"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); setQuickFilter(""); setPage(0); }} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>

          {/* Row 5: quick filters scrollable */}
          <div className="hide-scrollbar" style={{ display: "flex", gap: "6px", overflowX: "auto", padding: "2px 0" }}>
            {QUICK_FILTERS.map(qf => (
              <button key={qf.key} onClick={() => { setQuickFilter(qf.key); setDateFrom(undefined); setDateTo(undefined); setPage(0); }}
                style={{ flexShrink: 0 }}
                className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${quickFilter === qf.key ? "bg-[#1e3a5f] text-white" : "text-gray-500 hover:text-gray-800 border border-[#e2e8f0]"}`}>
                {qf.label}
              </button>
            ))}
          </div>

          {/* Row 6: actions */}
          <div style={{ display: "flex", gap: "8px", justifyContent: "space-between" }}>
            <button onClick={exportCSV} className="flex items-center gap-1 rounded-md border border-[#e2e8f0] px-3 py-1.5 text-[12px] font-medium text-gray-500 hover:text-gray-800 transition-colors">
              <Download size={12} /> CSV
            </button>
            <button onClick={resetFilters} className="flex items-center gap-1 text-[12px] text-gray-400 hover:text-gray-700 transition-colors">
              <X size={12} /> נקה
            </button>
          </div>
        </div>

        {/* Desktop: single horizontal scrollable row */}
        <div
          className="hidden md:flex items-center gap-2 hide-scrollbar"
          style={{
            flexDirection: "row",
            flexWrap: "nowrap",
            overflowX: "auto",
            padding: "4px 0 8px 0",
            scrollbarWidth: "none",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {/* Desktop search */}
          <div className="relative shrink min-w-[160px] flex-1">
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
          {hasAccountant && (
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }} className={sel}>
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
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

      {/* ── Bulk Action Bar ── */}
      {showAccountantActions && selectedIds.size > 0 && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 16px", backgroundColor: "#1e3a5f", color: "#ffffff",
          fontSize: "13px", fontFamily: "Heebo, sans-serif",
        }}>
          <button
            onClick={() => setSelectedIds(new Set())}
            style={{ background: "none", border: "none", color: "#94a3b8",
                     cursor: "pointer", fontSize: "13px", fontFamily: "Heebo, sans-serif" }}
          >
            ✕ נקה בחירה
          </button>
          <span>סומנו {selectedIds.size} חשבוניות</span>
          <button
            onClick={bulkApprove}
            disabled={bulkApproving}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "6px 16px", borderRadius: "8px", fontSize: "13px",
              backgroundColor: "#16a34a", color: "#ffffff",
              border: "none", cursor: "pointer", fontFamily: "Heebo, sans-serif",
              opacity: bulkApproving ? 0.6 : 1,
            }}
          >
            <CheckCircle size={14} />
            {bulkApproving ? "מאשר..." : "אשר נבחרים"}
          </button>
        </div>
      )}

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
          <div className="hidden md:block w-full bg-white overflow-hidden">
            <table className="w-full text-[12px]" style={{ width: "100%", tableLayout: "fixed" }}>
              <colgroup>
                {showAccountantActions && <col style={{ width: "40px" }} />}
                <col style={{ width: hasAccountant ? "8%" : "9%" }} />
                <col style={{ width: hasAccountant ? "15%" : "17%" }} />
                <col style={{ width: hasAccountant ? "9%" : "10%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: hasAccountant ? "10%" : "12%" }} />
                <col style={{ width: hasAccountant ? "8%" : "10%" }} />
                {hasAccountant && <col style={{ width: "9%" }} />}
                <col style={{ width: hasAccountant ? "17%" : "18%" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[11px] font-bold text-gray-500">
                  {showAccountantActions && (
                    <th className="px-3 py-3 text-center" style={{ width: "40px" }}>
                      <input
                        type="checkbox"
                        checked={paged.length > 0 && selectedIds.size === paged.length}
                        onChange={toggleSelectAll}
                        style={{ cursor: "pointer", width: "16px", height: "16px" }}
                      />
                    </th>
                  )}
                  <th className="px-2 py-3 text-right">תאריך</th>
                  <th className="px-2 py-3 text-right">ספק</th>
                  <th className="px-2 py-3 text-right">מספר חשבונית</th>
                  <th className="px-2 py-3 text-left">סכום</th>
                  <th className="px-2 py-3 text-left">מע״מ בפועל</th>
                  <th className="px-2 py-3 text-left">מע״מ מוכר</th>
                  <th className="px-2 py-3 text-right">קטגוריה</th>
                  <th className="px-2 py-3 text-right">סוג</th>
                  {hasAccountant && <th className="px-2 py-3 text-right">סטטוס</th>}
                  <th className="px-2 py-3 text-center">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(inv => {
                  const st = STATUS_MAP[inv.status] || STATUS_MAP.pending_review;
                  const cc = getCatColor(inv.category);
                  return (
                    <tr key={inv.id} className="border-b border-[#e2e8f0]/60 hover:bg-[#f8fafc] transition-colors">
                      {showAccountantActions && (
                        <td className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(inv.id)}
                            onChange={() => toggleSelect(inv.id)}
                            style={{ cursor: "pointer", width: "16px", height: "16px" }}
                          />
                        </td>
                      )}
                      <td className="px-2 py-3 whitespace-nowrap">{formatDate(inv.invoice_date)}</td>
                      <td className="px-2 py-3 truncate" title={inv.vendor || ""}>{inv.vendor || "—"}</td>
                      <td className="px-2 py-3 truncate">{inv.invoice_number || "—"}</td>
                      <td className="px-2 py-3 text-left font-mono tabular-nums whitespace-nowrap">{inv.total != null ? `₪${inv.total.toLocaleString("he-IL")}` : "—"}</td>
                      <td className="px-2 py-3 text-left font-mono tabular-nums whitespace-nowrap">{inv.vat_original != null ? `₪${inv.vat_original.toLocaleString("he-IL")}` : "—"}</td>
                      <td className="px-2 py-3 text-left font-mono tabular-nums whitespace-nowrap">{inv.vat_deductible != null ? `₪${inv.vat_deductible.toLocaleString("he-IL")}` : "—"}</td>
                      <td className="px-2 py-3"><span className="inline-block max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: cc.bg, color: cc.text }}>{inv.category || "—"}</span></td>
                      <td className="px-2 py-3 text-[11px] truncate">{inv.document_type || "—"}</td>
                      {hasAccountant && <td className="px-2 py-3"><span className="inline-block max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span></td>}
                      <td className="px-2 py-3">{renderActions(inv, showAccountantActions, true)}</td>
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
                  {showAccountantActions && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(inv.id)}
                        onChange={() => toggleSelect(inv.id)}
                        style={{ cursor: "pointer", width: "16px", height: "16px" }}
                      />
                      <span style={{ fontSize: "11px", color: "#64748b" }}>בחר</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[14px] text-[#1a202c] truncate">{inv.vendor || "—"}</span>
                    <span className="font-bold text-[14px] font-mono">{inv.total != null ? `₪${inv.total.toLocaleString("he-IL")}` : "—"}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[12px] text-gray-400">{formatDate(inv.invoice_date)}</span>
                    <span className="rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: cc.bg, color: cc.text }}>{inv.category || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[12px] text-gray-400">{inv.document_type || "—"}</span>
                    {hasAccountant && <span className="rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>}
                  </div>
                  <div className="mt-3 pt-3 border-t border-[#e2e8f0]">{renderActions(inv, showAccountantActions)}</div>
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
              onClick={() => {
                const inv = editPickerModal!;
                setEditPickerModal(null);
                setEditDetailsModal(inv);
                setEditDetailsVendor(inv.vendor || "");
                setEditDetailsDate(inv.invoice_date ? new Date(inv.invoice_date) : undefined);
                setEditDetailsTotal(inv.total != null ? inv.total.toString() : "");
              }}
              className="rounded-lg px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: "#e8941a" }}
            >עדכון פרטי חשבונית</button>
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

      {/* ── Archive Modal ── */}
      <Dialog open={!!archiveModal} onOpenChange={open => !open && setArchiveModal(null)}>
        <DialogContent className="max-w-[400px] rounded-2xl p-8" dir="rtl">
          <DialogHeader><DialogTitle className="text-lg font-bold" style={{ color: "#1e3a5f" }}>העברה לארכיון</DialogTitle></DialogHeader>
          <p className="mt-4 text-[14px] text-gray-500 leading-relaxed">להעביר את חשבונית <strong className="text-[#1a202c]">{archiveModal?.vendor}</strong> לארכיון?</p>
          <div className="mt-6 flex justify-end gap-2">
            <button onClick={() => setArchiveModal(null)} className="rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-[13px] font-medium hover:bg-gray-50 transition-colors">ביטול</button>
            <button onClick={archiveInvoice} className="rounded-lg px-4 py-2 text-[13px] font-medium text-white transition-colors" style={{ backgroundColor: "#64748b" }}>העבר לארכיון</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Approve Modal ── */}
      <Dialog open={!!approveModal} onOpenChange={open => !open && setApproveModal(null)}>
        <DialogContent className="max-w-[400px] rounded-2xl p-8" dir="rtl">
          <DialogHeader><DialogTitle className="text-lg font-bold" style={{ color: "#1e3a5f" }}>אישור חשבונית</DialogTitle></DialogHeader>
          <p className="mt-4 text-[14px] text-gray-500 leading-relaxed">לאשר את חשבונית <strong className="text-[#1a202c]">{approveModal?.vendor}</strong>?</p>
          <div className="mt-6 flex justify-end gap-2">
            <button onClick={() => setApproveModal(null)} className="rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-[13px] font-medium hover:bg-gray-50 transition-colors">ביטול</button>
            <button onClick={approveInvoice} className="rounded-lg px-4 py-2 text-[13px] font-medium text-white transition-colors" style={{ backgroundColor: "#16a34a" }}>אשר חשבונית</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Clarify Modal ── */}
      <Dialog open={!!clarifyModal} onOpenChange={open => { if (!open) { setClarifyModal(null); setClarifyText(""); } }}>
        <DialogContent className="max-w-[480px] rounded-2xl p-8" dir="rtl">
          <DialogHeader><DialogTitle className="text-lg font-bold" style={{ color: "#1e3a5f" }}>בקשת הבהרה — {clarifyModal?.vendor}</DialogTitle></DialogHeader>
          <p className="mt-2 text-[13px] text-gray-500">כתוב הודעה ללקוח. ההודעה תישמר בתיק החשבונית.</p>
          <textarea
            value={clarifyText}
            onChange={e => setClarifyText(e.target.value)}
            placeholder="לדוגמה: האם זו הוצאה עסקית? לאיזה פרויקט שייכת ההוצאה?"
            rows={4}
            className="mt-4 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-[14px] outline-none focus:ring-1 focus:ring-primary resize-none"
            style={{ fontFamily: "Heebo, sans-serif" }}
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => { setClarifyModal(null); setClarifyText(""); }}
              className="rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-[13px] font-medium hover:bg-gray-50 transition-colors"
            >ביטול</button>
            <button
              onClick={requestClarification}
              disabled={!clarifyText.trim() || clarifyLoading}
              className="rounded-lg px-4 py-2 text-[13px] font-medium text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: "#e8941a" }}
            >{clarifyLoading ? "שולח..." : "שלח בקשת הבהרה"}</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
