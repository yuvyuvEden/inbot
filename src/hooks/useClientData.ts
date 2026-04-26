import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export function useClientRecord() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["client-record", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, brand_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Parse date string — supports YYYY-MM-DD and DD/MM/YYYY */
function parseDate(dateStr: string | null): { day: number; month: number; year: number } | null {
  if (!dateStr) return null;
  // תומך בשני פורמטים: YYYY-MM-DD ו-DD/MM/YYYY
  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return { year: parseInt(iso[1]), month: parseInt(iso[2]), day: parseInt(iso[3]) };
  const dmy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return { day: parseInt(dmy[1]), month: parseInt(dmy[2]), year: parseInt(dmy[3]) };
  return null;
}

function getPeriodFilter(period: string): (dateStr: string | null) => boolean {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1-indexed

  switch (period) {
    case "this_month":
      return (d) => { const p = parseDate(d); return !!p && p.month === m && p.year === y; };
    case "last_month": {
      const lm = m === 1 ? 12 : m - 1;
      const ly = m === 1 ? y - 1 : y;
      return (d) => { const p = parseDate(d); return !!p && p.month === lm && p.year === ly; };
    }
    case "this_quarter": {
      const qStart = Math.floor((m - 1) / 3) * 3 + 1;
      const qEnd = qStart + 2;
      return (d) => { const p = parseDate(d); return !!p && p.year === y && p.month >= qStart && p.month <= qEnd; };
    }
    case "last_quarter": {
      let qStart = Math.floor((m - 1) / 3) * 3 + 1 - 3;
      let qYear = y;
      if (qStart < 1) { qStart += 12; qYear--; }
      const qEnd = qStart + 2;
      return (d) => { const p = parseDate(d); return !!p && p.year === qYear && p.month >= qStart && p.month <= qEnd; };
    }
    case "this_year":
      return (d) => { const p = parseDate(d); return !!p && p.year === y; };
    default:
      return () => true;
  }
}

function getPreviousPeriodKey(period: string): string | null {
  switch (period) {
    case "this_month": return "last_month";
    case "this_quarter": return "last_quarter";
    default: return null;
  }
}

async function fetchAllInvoices(clientId: string) {
  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_date, vendor, total, vat_deductible, tax_deductible, allocation_number, category, status, is_archived, created_at")
    .eq("client_id", clientId)
    .eq("is_archived", false);
  if (error) throw error;
  return data || [];
}

function computeKPIs(invoices: any[], periodFilter: (d: string | null) => boolean) {
  // כלול חשבוניות שאינן בארכיון (is_archived=false כבר מסונן ב-fetchAllInvoices)
  // סנן רק archived — שאר הסטטוסים נכללים
  const filtered = invoices.filter((i) =>
    i.status !== "archived" &&
    periodFilter(i.invoice_date)
  );
  return {
    totalExpenses: filtered.reduce((s, i) => s + (i.total || 0), 0),
    totalVat: filtered.reduce((s, i) => s + (i.vat_deductible || 0), 0),
    totalTax: filtered.reduce((s, i) => s + (i.tax_deductible || 0), 0),
    count: filtered.length,
    noAllocation: filtered.filter((i) => !i.allocation_number || i.allocation_number.trim() === "").length,
  };
}

export function useInvoiceKPIs(clientId: string | undefined, period: string) {
  return useQuery({
    queryKey: ["invoice-kpis", clientId, period],
    enabled: !!clientId,
    queryFn: async () => {
      const all = await fetchAllInvoices(clientId!);
      return computeKPIs(all, getPeriodFilter(period));
    },
  });
}

export function useInvoiceKPIsDelta(clientId: string | undefined, period: string) {
  const prevKey = getPreviousPeriodKey(period);
  return useQuery({
    queryKey: ["invoice-kpis-prev", clientId, prevKey],
    enabled: !!clientId && !!prevKey,
    queryFn: async () => {
      const all = await fetchAllInvoices(clientId!);
      return computeKPIs(all, getPeriodFilter(prevKey!));
    },
  });
}

export function useExpenseTimeline(clientId: string | undefined, period: string) {
  const isYearView = period === "this_year";

  return useQuery({
    queryKey: ["expense-timeline", clientId, period],
    enabled: !!clientId,
    queryFn: async () => {
      const all = await fetchAllInvoices(clientId!);
      const filter = getPeriodFilter(period);
      const filtered = all.filter((i) =>
        (i.status === "approved" || i.status === "pending_review" || i.status === "needs_clarification")
        && filter(i.invoice_date)
      );

      const grouped: Record<string, number> = {};
      filtered.forEach((inv) => {
        const p = parseDate(inv.invoice_date);
        if (!p) return;
        const key = isYearView
          ? `${p.year}-${String(p.month).padStart(2, "0")}`
          : `${String(p.day).padStart(2, "0")}/${String(p.month).padStart(2, "0")}`;
        grouped[key] = (grouped[key] || 0) + (inv.total || 0);
      });

      return Object.entries(grouped)
        .map(([date, total]) => ({ date, total }))
        .sort((a, b) => a.date.localeCompare(b.date));
    },
  });
}

export function useCategoryBreakdown(clientId: string | undefined, period: string) {
  return useQuery({
    queryKey: ["category-breakdown", clientId, period],
    enabled: !!clientId,
    queryFn: async () => {
      const all = await fetchAllInvoices(clientId!);
      const filter = getPeriodFilter(period);
      const filtered = all.filter((i) =>
        (i.status === "approved" || i.status === "pending_review" || i.status === "needs_clarification")
        && filter(i.invoice_date)
      );

      const grouped: Record<string, number> = {};
      filtered.forEach((inv) => {
        const cat = inv.category || "ללא קטגוריה";
        grouped[cat] = (grouped[cat] || 0) + (inv.total || 0);
      });

      return Object.entries(grouped).map(([name, value]) => ({ name, value }));
    },
  });
}

export function useRecentInvoices(clientId: string | undefined) {
  return useQuery({
    queryKey: ["recent-invoices", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_date, vendor, total, category, status")
        .eq("client_id", clientId!)
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useUnreadThreads(clientId: string | undefined) {
  return useQuery({
    queryKey: ["client-unread-threads", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data: invoices, error: invErr } = await supabase
        .from("invoices")
        .select("id, invoice_comments(author_role, created_at)")
        .eq("client_id", clientId!);
      if (invErr) throw invErr;

      return (invoices ?? []).filter((inv: any) => {
        const comments = (inv.invoice_comments ?? []).sort(
          (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const lastAccountantMsg = comments.filter((c: any) => c.author_role === "accountant").slice(-1)[0];
        if (!lastAccountantMsg) return false;
        const clientRepliedAfter = comments.some(
          (c: any) => c.author_role === "client" && new Date(c.created_at) > new Date(lastAccountantMsg.created_at)
        );
        return !clientRepliedAfter;
      }).length;
    },
  });
}
