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
  monthlyPrice: number,
  yearlyPrice: number
) {
  const amount = billingCycle === "yearly" ? yearlyPrice : monthlyPrice;
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

// סטטיסטיקות חיוב לאדמין
export function useBillingStats() {
  return useQuery({
    queryKey: ["billing-stats"],
    queryFn: async () => {
      const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM

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

// יצירת רשומת חיוב ידנית
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
    }: {
      id: string;
      status: string;
      payment_method?: string;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from("billing_log")
        .update({
          status,
          payment_method,
          notes,
          paid_at: status === "paid" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-log"] });
      queryClient.invalidateQueries({ queryKey: ["billing-stats"] });
      toast.success("סטטוס עודכן");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
