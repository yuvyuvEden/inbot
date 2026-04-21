import { supabase } from "@/integrations/supabase/client";

export class ConflictError extends Error {
  constructor() {
    super("CONFLICT");
    this.name = "ConflictError";
  }
}

/**
 * optimisticUpdate — מעדכן רשומה רק אם updated_at לא השתנה מאז נטענה
 * אם מישהו אחר עדכן בינתיים — זורק ConflictError
 */
export async function optimisticUpdate(
  table: "invoices" | "clients" | "accountants",
  id: string,
  originalUpdatedAt: string,
  updates: Record<string, unknown>
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from(table)
    .update({ ...updates, updated_by: user?.id ?? null })
    .eq("id", id)
    .eq("updated_at", originalUpdatedAt)
    .select("id");

  if (error) throw error;
  if (!data || data.length === 0) throw new ConflictError();
}
