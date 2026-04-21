import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const VAT = 0.18;

// חישוב סכום חיוב לרו"ח
export function calcAccountantBill(
  activeClientCount: number,
  baseClientCount: number,
  basePrice: number,
  extraClientPrice: number
) {
  const extraCount = Math.max(0, activeClientCount - baseClientCount);
  const baseAmount = basePrice;
  const extraAmount = extraCount * extraClientPrice;
  const totalBeforeVat = baseAmount + extraAmount;
  const vatAmount = Math.round(totalBeforeVat * VAT * 100) / 100;
  const totalWithVat = Math.round((totalBeforeVat + vatAmount) * 100) / 100;
  return { extraCount, baseAmount, extraAmount, totalBeforeVat, vatAmount, totalWithVat };
}

// חישוב סכום חיוב ללקוח ישיר
export function calcClientBill(
  billingCycle: string,
  lockedMonthlyPrice: number | null,
  lockedYearlyPrice: number | null,
  planMonthlyPrice: number,
  planYearlyPrice: number
) {
  const monthly = lockedMonthlyPrice ?? planMonthlyPrice;
  const yearly = lockedYearlyPrice ?? planYearlyPrice;
  const amount = billingCycle === "yearly" ? yearly : monthly;
  const vatAmount = Math.round(amount * VAT * 100) / 100;
  const totalWithVat = Math.round((amount + vatAmount) * 100) / 100;
  return { baseAmount: amount, vatAmount, totalWithVat };
}

// שליפת לוג חיוב
export function useBillingLog(entityType?: string, entityId?: string) {
  return useQuery({
    queryKey: ["billing-log", entityType, entityId],
    queryFn: async () => {
      let q = supabase
        .from("billing_log")
        .select("*")
        .order("billing_period", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);
      if (entityType) q = q.eq("entity_type", entityType);
      if (entityId) q = q.eq("entity_id", entityId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

// שליפת לוג עם שמות גורמים מצורפים
export function useBillingLogWithNames(filters?: {
  entityType?: string;
  entityId?: string;
  period?: string;
  status?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ["billing-log-names", filters],
    queryFn: async () => {
      let q = supabase
        .from("billing_log")
        .select("*")
        .order("billing_period", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (filters?.entityType) q = q.eq("entity_type", filters.entityType);
      if (filters?.entityId) q = q.eq("entity_id", filters.entityId);
      if (filters?.period) q = q.eq("billing_period", filters.period);
      if (filters?.status) q = q.eq("status", filters.status);
      const { data, error } = await q;
      if (error) throw error;
      const logs = data ?? [];

      const accIds = [...new Set(logs.filter((l) => l.entity_type === "accountant").map((l) => l.entity_id))];
      const clientIds = [...new Set(logs.filter((l) => l.entity_type !== "accountant").map((l) => l.entity_id))];

      const [accRes, clientRes] = await Promise.all([
        accIds.length
          ? supabase.from("accountants").select("id, name, email").in("id", accIds)
          : Promise.resolve({ data: [] as any[] }),
        clientIds.length
          ? supabase.from("clients").select("id, brand_name, legal_name").in("id", clientIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const accMap = new Map((accRes.data ?? []).map((a: any) => [a.id, a.name ?? a.email]));
      const clientMap = new Map((clientRes.data ?? []).map((c: any) => [c.id, c.brand_name ?? c.legal_name]));

      return logs.map((l: any) => ({
        ...l,
        entity_name:
          l.entity_type === "accountant"
            ? accMap.get(l.entity_id) ?? "—"
            : clientMap.get(l.entity_id) ?? "—",
      }));
    },
  });
}

// סטטיסטיקות חיוב לאדמין
export function useBillingStats() {
  return useQuery({
    queryKey: ["billing-stats"],
    queryFn: async () => {
      const currentPeriod = new Date().toISOString().slice(0, 7);

      const { data, error } = await supabase
        .from("billing_log")
        .select("*")
        .eq("billing_period", currentPeriod);

      if (error) throw error;
      const logs = data ?? [];

      return {
        expectedRevenue: logs
          .filter((l) => l.status !== "waived")
          .reduce((s, l) => s + (Number(l.total_before_vat) ?? 0), 0),
        collectedRevenue: logs
          .filter((l) => l.status === "paid")
          .reduce((s, l) => s + (Number(l.total_before_vat) ?? 0), 0),
        pendingCount: logs.filter((l) => l.status === "pending").length,
        failedCount: logs.filter((l) => l.status === "failed").length,
        waivedCount: logs.filter((l) => l.status === "waived").length,
        logs,
      };
    },
  });
}

// יצירת רשומת חיוב ידנית (עם בדיקת כפילות)
export function useCreateBillingEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entry: {
      entity_type: string;
      entity_id: string;
      billing_period: string;
      billing_day?: number;
      base_count?: number;
      extra_count?: number;
      base_amount: number;
      extra_amount: number;
      total_before_vat: number;
      vat_amount: number;
      total_with_vat: number;
      status: string;
      payment_method?: string;
      notes?: string;
    }) => {
      // בדיקת כפילות
      const { data: existing } = await supabase
        .from("billing_log")
        .select("id")
        .eq("entity_type", entry.entity_type)
        .eq("entity_id", entry.entity_id)
        .eq("billing_period", entry.billing_period)
        .maybeSingle();
      if (existing) throw new Error("קיים כבר חיוב לתקופה זו עבור גורם זה");

      const { data, error } = await supabase
        .from("billing_log")
        .insert(entry)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-log"] });
      queryClient.invalidateQueries({ queryKey: ["billing-log-names"] });
      queryClient.invalidateQueries({ queryKey: ["billing-stats"] });
      toast.success("רשומת חיוב נוצרה");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// עדכון סטטוס תשלום
export function useUpdateBillingStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      payment_method,
      notes,
      external_payment_id,
    }: {
      id: string;
      status: string;
      payment_method?: string;
      notes?: string;
      external_payment_id?: string;
    }) => {
      const updates: any = {
        status,
        payment_method,
        notes,
        paid_at: status === "paid" ? new Date().toISOString() : null,
      };
      if (external_payment_id !== undefined) {
        updates.external_payment_id = external_payment_id;
      }
      const { error } = await supabase.from("billing_log").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-log"] });
      queryClient.invalidateQueries({ queryKey: ["billing-log-names"] });
      queryClient.invalidateQueries({ queryKey: ["billing-stats"] });
      toast.success("סטטוס עודכן");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// מחיקת רשומת חיוב
export function useDeleteBillingEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("billing_log").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-log"] });
      queryClient.invalidateQueries({ queryKey: ["billing-log-names"] });
      queryClient.invalidateQueries({ queryKey: ["billing-stats"] });
      toast.success("רשומת חיוב נמחקה");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ויתור על חיוב
export function useWaiveBillingEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const { error } = await supabase
        .from("billing_log")
        .update({ status: "waived", payment_method: "free", notes: notes ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-log"] });
      queryClient.invalidateQueries({ queryKey: ["billing-log-names"] });
      queryClient.invalidateQueries({ queryKey: ["billing-stats"] });
      toast.success("חיוב סומן כפטור");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
