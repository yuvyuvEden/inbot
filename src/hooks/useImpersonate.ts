import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useImpersonate() {
  const [loading, setLoading] = useState<string | null>(null);

  const impersonate = async (
    target_user_id: string | null,
    target_name: string,
    redirectPath: "/accountant" | "/dashboard"
  ) => {
    if (!target_user_id) {
      toast.error("למשתמש זה אין חשבון פעיל");
      return;
    }
    setLoading(target_user_id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("לא מחובר");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-impersonate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ target_user_id }),
        }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "שגיאה לא ידועה");

      const actionLink = json.action_link as string;
      const url = new URL(actionLink);
      url.searchParams.set("redirect_to", `${window.location.origin}${redirectPath}`);

      window.open(url.toString(), "_blank");
      toast.success(`נפתח טאב חדש כ-${target_name}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`שגיאה: ${message}`);
    } finally {
      setLoading(null);
    }
  };

  return { impersonate, loading };
}
