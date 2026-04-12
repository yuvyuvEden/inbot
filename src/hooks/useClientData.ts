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

function getPeriodRange(period: string): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (period) {
    case "this_month":
      return { start: `${y}-${String(m + 1).padStart(2, "0")}-01`, end: `${y}-${String(m + 1).padStart(2, "0")}-31` };
    case "last_month": {
      const d = new Date(y, m - 1, 1);
      const ly = d.getFullYear(), lm = d.getMonth();
      return { start: `${ly}-${String(lm + 1).padStart(2, "0")}-01`, end: `${ly}-${String(lm + 1).padStart(2, "0")}-31` };
    }
    case "this_quarter": {
      const qs = Math.floor(m / 3) * 3;
      return { start: `${y}-${String(qs + 1).padStart(2, "0")}-01`, end: `${y}-${String(qs + 3).padStart(2, "0")}-31` };
    }
    case "last_quarter": {
      const cqs = Math.floor(m / 3) * 3;
      const pqs = cqs - 3;
      if (pqs < 0) {
        return { start: `${y - 1}-10-01`, end: `${y - 1}-12-31` };
      }
      return { start: `${y}-${String(pqs + 1).padStart(2, "0")}-01`, end: `${y}-${String(pqs + 3).padStart(2, "0")}-31` };
    }
    case "this_year":
      return { start: `${y}-01-01`, end: `${y}-12-31` };
    default:
      return { start: `${y}-${String(m + 1).padStart(2, "0")}-01`, end: `${y}-${String(m + 1).padStart(2, "0")}-31` };
  }
}

function getPreviousPeriod(period: string): string {
  switch (period) {
    case "this_month": return "last_month";
    case "this_quarter": return "last_quarter";
    case "this_year": {
      const y = new Date().getFullYear();
      return `custom_${y - 1}-01-01_${y - 1}-12-31`;
    }
    default: return "";
  }
}

function getCustomRange(period: string): { start: string; end: string } | null {
  if (period.startsWith("custom_")) {
    const [, start, end] = period.split("_");
    return { start, end };
  }
  return null;
}

function resolveRange(period: string) {
  return getCustomRange(period) || getPeriodRange(period);
}

async function fetchKPIData(clientId: string, period: string) {
  const { start, end } = resolveRange(period);
  const { data, error } = await supabase
    .from("invoices")
    .select("total, vat_deductible, tax_deductible, allocation_number")
    .eq("client_id", clientId)
    .eq("is_archived", false)
    .eq("status", "approved")
    .gte("invoice_date", start)
    .lte("invoice_date", end);

  if (error) throw error;
  const invoices = data || [];
  return {
    totalExpenses: invoices.reduce((s, i) => s + (i.total || 0), 0),
    totalVat: invoices.reduce((s, i) => s + (i.vat_deductible || 0), 0),
    totalTax: invoices.reduce((s, i) => s + (i.tax_deductible || 0), 0),
    count: invoices.length,
    noAllocation: invoices.filter((i) => !i.allocation_number || i.allocation_number.trim() === "").length,
  };
}

export function useInvoiceKPIs(clientId: string | undefined, period: string) {
  return useQuery({
    queryKey: ["invoice-kpis", clientId, period],
    enabled: !!clientId,
    queryFn: () => fetchKPIData(clientId!, period),
  });
}

export function useInvoiceKPIsDelta(clientId: string | undefined, period: string) {
  const prevPeriod = getPreviousPeriod(period);
  return useQuery({
    queryKey: ["invoice-kpis-prev", clientId, prevPeriod],
    enabled: !!clientId && !!prevPeriod,
    queryFn: () => fetchKPIData(clientId!, prevPeriod),
  });
}

export function useExpenseTimeline(clientId: string | undefined, period: string) {
  const { start, end } = resolveRange(period);
  const isYearView = period === "this_year" || period.startsWith("custom_");

  return useQuery({
    queryKey: ["expense-timeline", clientId, period],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("invoice_date, total")
        .eq("client_id", clientId!)
        .eq("is_archived", false)
        .eq("status", "approved")
        .gte("invoice_date", start)
        .lte("invoice_date", end)
        .order("invoice_date", { ascending: true });

      if (error) throw error;

      const grouped: Record<string, number> = {};
      (data || []).forEach((inv) => {
        if (!inv.invoice_date) return;
        const key = isYearView ? inv.invoice_date.slice(0, 7) : inv.invoice_date.slice(0, 10);
        grouped[key] = (grouped[key] || 0) + (inv.total || 0);
      });

      return Object.entries(grouped).map(([date, total]) => ({ date, total }));
    },
  });
}

export function useCategoryBreakdown(clientId: string | undefined, period: string) {
  const { start, end } = resolveRange(period);

  return useQuery({
    queryKey: ["category-breakdown", clientId, period],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("category, total")
        .eq("client_id", clientId!)
        .eq("is_archived", false)
        .eq("status", "approved")
        .gte("invoice_date", start)
        .lte("invoice_date", end);

      if (error) throw error;

      const grouped: Record<string, number> = {};
      (data || []).forEach((inv) => {
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
        .order("invoice_date", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data || [];
    },
  });
}

export function useUnreadComments(clientId: string | undefined) {
  return useQuery({
    queryKey: ["unread-comments", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data: invoices, error: invErr } = await supabase
        .from("invoices")
        .select("id")
        .eq("client_id", clientId!);
      if (invErr) throw invErr;
      if (!invoices?.length) return 0;

      const ids = invoices.map((i) => i.id);
      const { count, error } = await supabase
        .from("invoice_comments")
        .select("id", { count: "exact", head: true })
        .in("invoice_id", ids)
        .eq("is_read", false);
      if (error) throw error;
      return count || 0;
    },
  });
}
