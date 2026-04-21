import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// שליפת כל החבילות
export function usePlans() {
  return useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .order("monthly_price", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// עדכון חבילה
export function useUpdatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
      applyToExisting,
      changedBy,
    }: {
      id: string;
      updates: {
        monthly_price?: number;
        yearly_price?: number;
        user_limit?: number;
        invoice_limit?: number;
        is_active?: boolean;
      };
      applyToExisting: boolean;
      changedBy: string;
    }) => {
      const { data: current } = await supabase
        .from("plans")
        .select("monthly_price, yearly_price")
        .eq("id", id)
        .single();

      if (current && (updates.monthly_price !== undefined || updates.yearly_price !== undefined)) {
        await supabase.from("plan_price_history").insert({
          plan_id: id,
          monthly_price: updates.monthly_price ?? Number(current.monthly_price),
          yearly_price: updates.yearly_price ?? Number(current.yearly_price),
          apply_to_existing: applyToExisting,
          changed_by: changedBy,
        });
      }

      const { error } = await supabase
        .from("plans")
        .update(updates)
        .eq("id", id);
      if (error) throw error;

      if (applyToExisting && updates.monthly_price !== undefined) {
        toast.info("המחיר עודכן — יחול על כל הלקוחות בחידוש הבא");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      toast.success("החבילה עודכנה");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// משתמשים משניים
export function useClientUsers(clientId?: string) {
  return useQuery({
    queryKey: ["client-users", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_users")
        .select("*")
        .eq("client_id", clientId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddClientUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (user: {
      client_id: string;
      name: string;
      telegram_chat_id?: string;
      email?: string;
    }) => {
      const { error } = await supabase.from("client_users").insert(user);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["client-users", vars.client_id] });
      toast.success("משתמש נוסף");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateInvoiceOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      clientId,
      override,
      price,
    }: {
      clientId: string;
      override: number;
      price: number;
    }) => {
      const { error } = await supabase
        .from("clients")
        .update({
          invoice_limit_override: override,
          extra_invoice_price: price,
        })
        .eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["billing-stats"] });
      toast.success("תוספת חשבוניות עודכנה");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
