import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export function useClientOnboarding(clientId: string | undefined) {
  return useQuery({
    queryKey: ["client-onboarding", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, gemini_api_key, business_nature, telegram_chat_id, sheet_id")
        .eq("id", clientId!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}
