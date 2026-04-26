import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// שליפת רשימת לקוחות המשויכים לרו"ח המחובר
export function useMyClients(overrideUserId?: string | null) {
  return useQuery({
    queryKey: ["my-clients", overrideUserId],
    queryFn: async () => {
      // קבע את ה-user_id — אם יש override (מצב אדמין) השתמש בו,
      // אחרת השתמש במשתמש המחובר
      let userId: string;
      if (overrideUserId) {
        userId = overrideUserId;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("לא מחובר");
        userId = user.id;
      }

      const { data: accountant, error: accErr } = await supabase
        .from("accountants")
        .select("id")
        .eq("user_id", userId)
        .single();
      if (accErr || !accountant) throw new Error("לא נמצא רואה חשבון");

      const { data, error } = await supabase
        .from("accountant_clients")
        .select(`
          assigned_at,
          clients (
            id, brand_name, legal_name, vat_number,
            is_active, plan_type, created_at
          )
        `)
        .eq("accountant_id", accountant.id)
        .is("unassigned_at", null);

      if (error) throw error;
      return data?.map((row: any) => row.clients).filter(Boolean) ?? [];
    },
  });
}

// KPIs מאוחדים לרו"ח — מחשב על כל לקוחותיו
export function useAccountantKPIs(clientIds: string[]) {
  return useQuery({
    queryKey: ["accountant-kpis", clientIds],
    enabled: clientIds.length > 0,
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("invoices")
        .select("id, total, status, is_archived, invoice_date, client_id")
        .in("client_id", clientIds);

      if (error) throw error;
      const invoices = data ?? [];

      const thisMonthInvoices = invoices.filter((i: any) =>
        i.invoice_date && i.invoice_date >= startOfMonth && i.invoice_date <= endOfMonth
      );

      return {
        totalExpenses: thisMonthInvoices.reduce((s: number, i: any) => s + (i.total ?? 0), 0),
        pendingReview: invoices.filter((i: any) => i.status === "pending_review").length,
        needsClarification: invoices.filter((i: any) => i.status === "needs_clarification").length,
        archivedThisMonth: thisMonthInvoices.filter((i: any) => i.is_archived).length,
      };
    },
  });
}

// ספירות חשבוניות לפי סטטוס לכל לקוח בנפרד
export function useClientInvoiceCounts(clientIds: string[]) {
  return useQuery({
    queryKey: ["client-invoice-counts", clientIds],
    enabled: clientIds.length > 0,
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("invoices")
        .select("client_id, total, status, is_archived, invoice_date")
        .in("client_id", clientIds);

      if (error) throw error;
      const invoices = data ?? [];

      const map: Record<string, {
        monthlyTotal: number;
        pending: number;
        clarification: number;
        archived: number;
      }> = {};

      for (const inv of invoices as any[]) {
        if (!map[inv.client_id]) {
          map[inv.client_id] = { monthlyTotal: 0, pending: 0, clarification: 0, archived: 0 };
        }
        const inMonth = inv.invoice_date && inv.invoice_date >= startOfMonth && inv.invoice_date <= endOfMonth;
        if (inMonth) map[inv.client_id].monthlyTotal += inv.total ?? 0;
        if (inv.status === "pending_review") map[inv.client_id].pending++;
        if (inv.status === "needs_clarification") map[inv.client_id].clarification++;
        if (inv.is_archived && inMonth) map[inv.client_id].archived++;
      }

      return map;
    },
  });
}

export function useUnreadAccountantComments(clientIds: string[]) {
  return useQuery({
    queryKey: ["unread-accountant-comments", clientIds],
    enabled: clientIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_comments")
        .select("id, invoice_id, body, author_role, created_at, is_read, invoices(client_id, vendor, invoice_number)")
        .eq("is_read", false)
        .eq("author_role", "client");

      console.log("RAW comments:", data, "error:", error);
      console.log("clientIds filter:", clientIds);

      if (error) throw error;
      const filtered = (data ?? []).filter((c: any) =>
        clientIds.includes(c.invoices?.client_id)
      );
      console.log("FILTERED comments:", filtered);
      return filtered;
    },
  });
}
