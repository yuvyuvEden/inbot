import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VatRule {
  category: string;
  vat_rate: number;
  tax_rate: number;
  no_vat: boolean;
  updated_at: string;
}

export function useVatRules() {
  return useQuery({
    queryKey: ["vat-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vat_rules")
        .select("*")
        .order("category");
      if (error) throw error;
      return (data ?? []) as VatRule[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateVatRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rule: Pick<VatRule, "category" | "vat_rate" | "tax_rate" | "no_vat">) => {
      const { error } = await supabase
        .from("vat_rules")
        .update({
          vat_rate: rule.vat_rate,
          tax_rate: rule.tax_rate,
          no_vat: rule.no_vat,
          updated_at: new Date().toISOString(),
        })
        .eq("category", rule.category);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vat-rules"] }),
  });
}

// פונקציית עזר — מחשבת vat_original ו-vat_deductible לפי כלל גלובלי
export function calcVat(
  total: number,
  rule: VatRule | undefined,
  vatRatePercent = 18
): { vat_original: number; vat_deductible: number } {
  if (!rule || rule.no_vat || total <= 0) {
    return { vat_original: 0, vat_deductible: 0 };
  }
  const divisor = 1 + vatRatePercent / 100;
  const vat_original = Math.round((total / divisor) * (vatRatePercent / 100) * 100) / 100;
  const vat_deductible = Math.round(vat_original * rule.vat_rate * 100) / 100;
  return { vat_original, vat_deductible };
}
