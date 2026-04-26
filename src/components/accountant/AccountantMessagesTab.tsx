import { useState } from "react";
import { useUnreadAccountantComments } from "@/hooks/useAccountantData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";

interface Props { clientIds: string[]; }

export function AccountantMessagesTab({ clientIds }: Props) {
  const queryClient = useQueryClient();
  const { data: comments = [], isLoading } = useUnreadAccountantComments(clientIds);

  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [sendingReply, setSendingReply] = useState<Record<string, boolean>>({});

  const markAsRead = async (commentId: string) => {
    await supabase.from("invoice_comments").update({ is_read: true }).eq("id", commentId);
    queryClient.invalidateQueries({ queryKey: ["unread-accountant-comments"] });
  };

  const sendReply = async (invoiceId: string, invoiceNumber: string, vendorName: string, _clientId: string) => {
    const text = replyTexts[invoiceId]?.trim();
    if (!text) return;
    setSendingReply(prev => ({ ...prev, [invoiceId]: true }));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("invoice_comments").insert({
        invoice_id: invoiceId,
        author_id: user?.id as string,
        author_role: "accountant",
        body: text,
        is_read: false,
      });
      await supabase.functions.invoke("accountant-send-email", {
        body: { invoice_id: invoiceId, message: text, invoice_number: invoiceNumber, vendor: vendorName }
      });
      setReplyTexts(prev => ({ ...prev, [invoiceId]: "" }));
      queryClient.invalidateQueries({ queryKey: ["unread-accountant-comments"] });
    } finally {
      setSendingReply(prev => ({ ...prev, [invoiceId]: false }));
    }
  };

  // Group comments by invoice_id
  const grouped = (comments as any[]).reduce((acc: Record<string, any[]>, c: any) => {
    const key = c.invoice_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});
  // Sort each group chronologically (ASC)
  Object.keys(grouped).forEach(k => {
    grouped[k].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  });

  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: "12px", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
        <MessageSquare size={20} color="#1e3a5f" />
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#1e3a5f", margin: 0 }}>הודעות שלא נקראו</h2>
      </div>

      {isLoading ? (
        <p style={{ color: "#64748b" }}>טוען...</p>
      ) : Object.keys(grouped).length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 16px" }}>
          <p style={{ color: "#64748b", fontSize: "14px", margin: 0 }}>אין הודעות חדשות מלקוחות 🎉</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {(Object.entries(grouped) as [string, any[]][]).map(([invoiceId, threadComments]) => {
            const first = threadComments[0];
            const vendorName = first.invoices?.vendor ?? "חשבונית";
            const invoiceNumber = first.invoices?.invoice_number ?? "";
            const clientId = first.invoices?.client_id ?? "";
            return (
              <div
                key={invoiceId}
                style={{
                  padding: "16px",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#f8fafc",
                }}
              >
                <div style={{ fontWeight: 700, color: "#1e3a5f", fontSize: "14px", marginBottom: "12px" }}>
                  {vendorName} #{invoiceNumber}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {threadComments.map((comment: any) => (
                    <div
                      key={comment.id}
                      style={{
                        padding: "10px 12px",
                        borderRadius: "8px",
                        backgroundColor: "#ffffff",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px", gap: "8px", flexWrap: "wrap" }}>
                        <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
                          לקוח
                        </div>
                        <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                          {new Date(comment.created_at).toLocaleString("he-IL")}
                        </div>
                      </div>
                      <p style={{ margin: 0, color: "#334155", fontSize: "13px", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                        {comment.body}
                      </p>
                      <button
                        onClick={() => markAsRead(comment.id)}
                        style={{ marginTop: "8px", padding: "4px 10px", borderRadius: "6px", backgroundColor: "transparent", color: "#1e3a5f", border: "1px solid #1e3a5f", cursor: "pointer", fontSize: "11px", fontFamily: "Heebo, sans-serif" }}
                      >
                        ✓ סמן כנקרא
                      </button>
                    </div>
                  ))}
                </div>

                <textarea
                  value={replyTexts[invoiceId] ?? ""}
                  onChange={(e) => setReplyTexts(prev => ({ ...prev, [invoiceId]: e.target.value }))}
                  placeholder="כתוב תשובה ללקוח..."
                  style={{ width: "100%", minHeight: "70px", padding: "8px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px", fontFamily: "Heebo, sans-serif", boxSizing: "border-box", resize: "vertical", marginTop: "12px" }}
                />
                <button
                  onClick={() => sendReply(invoiceId, invoiceNumber, vendorName, clientId)}
                  disabled={sendingReply[invoiceId] || !replyTexts[invoiceId]?.trim()}
                  style={{ marginTop: "8px", padding: "8px 20px", borderRadius: "8px", backgroundColor: "#1e3a5f", color: "#ffffff", border: "none", cursor: sendingReply[invoiceId] ? "not-allowed" : "pointer", fontSize: "13px", fontFamily: "Heebo, sans-serif", fontWeight: 600, opacity: sendingReply[invoiceId] || !replyTexts[invoiceId]?.trim() ? 0.6 : 1 }}
                >
                  {sendingReply[invoiceId] ? "שולח..." : "שלח תשובה"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
