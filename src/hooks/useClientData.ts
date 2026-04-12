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

export function useInvoiceKPIs(clientId: string | undefined, period: string) {
  const { start, end } = getPeriodRange(period);

  return useQuery({
    queryKey: ["invoice-kpis", clientId, period],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("total, vat_deductible, tax_deductible, allocation_number")
        .eq("client_id", clientId!)
        .eq("is_archived", false)
        .eq("status", "approved")
        .gte("invoice_date", start)
        .lte("invoice_date", end);

      if (error) throw error;

      const invoices = data || [];
      const totalExpenses = invoices.reduce((s, i) => s + (i.total || 0), 0);
      const totalVat = invoices.reduce((s, i) => s + (i.vat_deductible || 0), 0);
      const totalTax = invoices.reduce((s, i) => s + (i.tax_deductible || 0), 0);
      const count = invoices.length;
      const noAllocation = invoices.filter(
        (i) => !i.allocation_number || i.allocation_number.trim() === ""
      ).length;

      return { totalExpenses, totalVat, totalTax, count, noAllocation };
    },
  });
}

export function useUnreadComments(clientId: string | undefined) {
  return useQuery({
    queryKey: ["unread-comments", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      // Get all invoice ids for this client
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
