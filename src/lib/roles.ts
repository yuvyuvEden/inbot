import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "accountant" | "client";

export async function getUserRole(userId: string): Promise<AppRole | null> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;
  return data.role as AppRole;
}

export async function hasRole(userId: string, role: AppRole): Promise<boolean> {
  const userRole = await getUserRole(userId);
  return userRole === role;
}
