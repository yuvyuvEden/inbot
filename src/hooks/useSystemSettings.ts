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
      // שלוף את הערך הישן לפני העדכון
      const { data: current } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();

      // עדכן את ההגדרה
      const { error } = await supabase
        .from("system_settings")
        .update({ value })
        .eq("key", key);
      if (error) throw error;

      // כתוב audit log — שגיאה כאן לא תעצור את השמירה
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("system_settings_audit").insert({
          key,
          old_value: current?.value ?? null,
          new_value: value,
          changed_by: user?.id ?? null,
        });
      } catch { /* ignore audit failures */ }
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
