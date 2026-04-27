import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SystemSetting {
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
}

export function useSystemSettings() {
  return useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .order("key");
      if (error) throw error;
      return (data ?? []) as SystemSetting[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateSystemSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase
        .from("system_settings")
        .update({ value })
        .eq("key", key);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      queryClient.invalidateQueries({ queryKey: ["vat-rules"] });
    },
  });
}

export function useVatRatePercent() {
  const { data: settings = [] } = useSystemSettings();
  const setting = settings.find((s) => s.key === "vat_rate_percent");
  return setting ? Number(setting.value) : 18;
}
