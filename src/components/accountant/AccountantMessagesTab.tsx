import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare } from "lucide-react";

interface Props { clientIds: string[]; }

export function AccountantMessagesTab({ clientIds }: Props) {
  const queryClient = useQueryClient();

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["accountant-unread-messages", clientIds],
    enabled: clientIds.length > 0,
    queryFn: async () => {
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, client_id, vendor, invoice_number")
        .in("client_id", clientIds);
      const invoiceIds = (invoices ?? []).map((i: any) => i.id);
      if (!invoiceIds.length) return [];
      const { data, error } = await supabase
        .from("invoice_comments")
        .select("id, invoice_id, body, created_at, is_read, author_role")
        .in("invoice_id", invoiceIds)
        .eq("author_role", "client")
        .eq("is_read", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const invoiceMap = new Map((invoices ?? []).map((i: any) => [i.id, i]));
      return (data ?? []).map((c: any) => ({
        ...c,
        invoice: invoiceMap.get(c.invoice_id),
      }));
    },
  });

  const markAsRead = async (commentId: string) => {
    await supabase.from("invoice_comments").update({ is_read: true }).eq("id", commentId);
    queryClient.invalidateQueries({ queryKey: ["accountant-unread-messages"] });
  };

  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: "12px", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
        <MessageSquare size={20} color="#1e3a5f" />
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#1e3a5f", margin: 0 }}>הודעות שלא נקראו</h2>
      </div>

      {isLoading ? (
        <p style={{ color: "#64748b" }}>טוען...</p>
      ) : comments.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 16px" }}>
          <p style={{ color: "#64748b", fontSize: "14px", margin: 0 }}>אין הודעות חדשות מלקוחות 🎉</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {comments.map((comment: any) => (
            <div
              key={comment.id}
              style={{
                padding: "14px 16px",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                backgroundColor: "#f8fafc",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px", gap: "8px", flexWrap: "wrap" }}>
                <div style={{ fontWeight: 600, color: "#1e3a5f", fontSize: "14px" }}>
                  {comment.invoice?.vendor ?? "חשבונית"} #{comment.invoice?.invoice_number ?? ""}
                </div>
                <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                  {new Date(comment.created_at).toLocaleString("he-IL")}
                </div>
              </div>
              <p style={{ margin: 0, color: "#334155", fontSize: "13px", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {comment.body}
              </p>
              <button
                onClick={() => markAsRead(comment.id)}
                style={{ marginTop: "10px", padding: "6px 14px", borderRadius: "6px", backgroundColor: "#1e3a5f", color: "#ffffff", border: "none", cursor: "pointer", fontSize: "12px", fontFamily: "Heebo, sans-serif" }}
              >
                ✓ סמן כנקרא
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
