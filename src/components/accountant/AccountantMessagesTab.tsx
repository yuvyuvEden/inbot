import { useUnreadAccountantComments } from "@/hooks/useAccountantData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";

interface Props { clientIds: string[]; }

export function AccountantMessagesTab({ clientIds }: Props) {
  const queryClient = useQueryClient();
  const { data: comments = [], isLoading } = useUnreadAccountantComments(clientIds);

  const markAsRead = async (commentId: string) => {
    await supabase.from("invoice_comments").update({ is_read: true }).eq("id", commentId);
    queryClient.invalidateQueries({ queryKey: ["unread-accountant-comments"] });
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
                  {comment.invoices?.vendor ?? "חשבונית"} #{comment.invoices?.invoice_number ?? ""}
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
