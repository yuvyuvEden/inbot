import { useUnreadAccountantComments } from "@/hooks/useAccountantData";
import { MessageSquare } from "lucide-react";

interface Props { clientIds: string[]; }

export function AccountantMessagesTab({ clientIds }: Props) {
  const { data: comments = [], isLoading } = useUnreadAccountantComments(clientIds);

  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: "12px", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
        <MessageSquare size={20} color="#1e3a5f" />
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#1e3a5f", margin: 0 }}>הודעות</h2>
      </div>

      {isLoading ? (
        <p style={{ color: "#64748b" }}>טוען...</p>
      ) : comments.length === 0 ? (
        <p style={{ color: "#64748b" }}>אין הודעות חדשות מלקוחות</p>
      ) : (
        <p style={{ color: "#1e3a5f", fontWeight: 500 }}>
          {comments.length} הודעות שלא נקראו — בקרוב: תיבת דואר מאוחדת
        </p>
      )}

      <div style={{ marginTop: "24px", padding: "16px", backgroundColor: "#fef3e2", borderRadius: "8px", border: "1px solid #fde6c4" }}>
        <p style={{ fontSize: "13px", color: "#92571a", margin: 0 }}>
          💡 תיבת הדואר המאוחדת תיבנה בשלב הבא (P1-009 — Resend email flow)
        </p>
      </div>
    </div>
  );
}
