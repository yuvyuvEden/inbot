import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare } from "lucide-react";

interface Props { clientId: string; }

export function AccountantTab({ clientId }: Props) {
  const { data: threads = [], isLoading } = useQuery({
    queryKey: ["accountant-threads", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data: invoices, error } = await supabase
        .from("invoices")
        .select(`
          id, vendor, invoice_number, total, status,
          invoice_comments (
            id, author_role, body, created_at, is_read
          )
        `)
        .eq("client_id", clientId)
        .eq("status", "needs_clarification")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (invoices ?? []).filter((inv: any) =>
        inv.invoice_comments && (inv.invoice_comments as any[]).length > 0
      );
    },
  });

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  if (isLoading) return <p style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>טוען...</p>;

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <MessageSquare size={20} color="#1e3a5f" />
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#1e3a5f", margin: 0 }}>הודעות מרואה החשבון</h2>
      </div>

      {threads.length === 0 ? (
        <div style={{ padding: "48px", textAlign: "center", color: "#94a3b8", backgroundColor: "#f8fafc", borderRadius: "12px" }}>
          <MessageSquare size={40} color="#cbd5e1" style={{ margin: "0 auto 12px" }} />
          <p style={{ margin: 0 }}>אין הודעות פתוחות מרואה החשבון</p>
        </div>
      ) : (
        threads.map((inv: any) => (
          <div key={inv.id} style={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
              <div>
                <span style={{ fontWeight: 700, color: "#1e3a5f" }}>{inv.vendor ?? "ספק לא ידוע"}</span>
                {inv.invoice_number && <span style={{ marginRight: "8px", color: "#64748b", fontSize: "13px" }}>#{inv.invoice_number}</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {inv.total && <span style={{ fontWeight: 600, color: "#1e3a5f" }}>{"₪" + Number(inv.total).toLocaleString("he-IL")}</span>}
                <span style={{ padding: "2px 10px", borderRadius: "9999px", fontSize: "12px", fontWeight: 600, backgroundColor: "#fef3e2", color: "#d97706" }}>
                  🟡 דרושה הבהרה
                </span>
              </div>
            </div>

            {/* Comment Thread */}
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px", backgroundColor: "#f8fafc" }}>
              {(inv.invoice_comments as any[])
                .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                .map((comment: any) => (
                  <div
                    key={comment.id}
                    style={{
                      backgroundColor: comment.author_role === "accountant" ? "#ffffff" : "#e0f2fe",
                      borderRadius: "8px",
                      padding: "12px",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "6px" }}>
                      {comment.author_role === "accountant" ? "🧾 רואה החשבון" : "👤 אתה"} • {fmt(comment.created_at)}
                    </div>
                    <p style={{ margin: 0, color: "#1e3a5f", fontSize: "14px", whiteSpace: "pre-wrap" }}>{comment.body}</p>
                  </div>
                ))
              }
            </div>

            {/* Reply hint */}
            <div style={{ padding: "12px 20px", backgroundColor: "#fef3e2", borderTop: "1px solid #fde6c4" }}>
              <p style={{ margin: 0, fontSize: "12px", color: "#92571a" }}>
                💡 כדי להשיב, השב ישירות למייל שקיבלת מ-INBOT
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
