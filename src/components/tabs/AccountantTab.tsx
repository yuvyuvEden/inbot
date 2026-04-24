import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MessageSquare } from "lucide-react";

interface Props { clientId: string; isAccountant?: boolean; }

export function AccountantTab({ clientId, isAccountant = false }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [resolving, setResolving] = useState<Record<string, boolean>>({});

  const handleResolve = async (invoiceId: string) => {
    setResolving((s) => ({ ...s, [invoiceId]: true }));
    try {
      const { error: cErr } = await supabase
        .from("invoice_comments")
        .update({ thread_status: "resolved" })
        .eq("invoice_id", invoiceId);
      if (cErr) throw cErr;
      const { error: iErr } = await supabase
        .from("invoices")
        .update({ status: "approved" })
        .eq("id", invoiceId);
      if (iErr) throw iErr;
      await queryClient.invalidateQueries({ queryKey: ["accountant-threads", clientId] });
    } catch (e) {
      console.error("Failed to resolve thread:", e);
    } finally {
      setResolving((s) => ({ ...s, [invoiceId]: false }));
    }
  };

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ["accountant-threads", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data: invoices, error } = await supabase
        .from("invoices")
        .select(`
          id, vendor, invoice_number, total, status,
          invoice_comments (
            id, author_role, body, created_at, is_read, thread_status
          )
        `)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const withComments = (invoices ?? []).filter((inv: any) =>
        inv.invoice_comments && (inv.invoice_comments as any[]).length > 0
      );

      // Compute thread status from latest comment, then sort: open first, resolved last
      const enriched = withComments.map((inv: any) => {
        const comments = [...(inv.invoice_comments as any[])].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const threadStatus = comments[0]?.thread_status ?? "open";
        return { ...inv, thread_status: threadStatus };
      });

      enriched.sort((a: any, b: any) => {
        if (a.thread_status === b.thread_status) return 0;
        return a.thread_status === "resolved" ? 1 : -1;
      });

      return enriched;
    },
  });

  useEffect(() => {
    if (!clientId) return;
    const markAsRead = async () => {
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id")
        .eq("client_id", clientId);
      if (!invoices?.length) return;
      const ids = invoices.map((i: any) => i.id);
      await supabase
        .from("invoice_comments")
        .update({ is_read: true })
        .in("invoice_id", ids)
        .eq("is_read", false)
        .eq("author_role", "accountant");
      queryClient.invalidateQueries({
        queryKey: ["unread-comments", clientId]
      });
    };
    markAsRead();
  }, [clientId]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  const handleSend = async (invoiceId: string) => {
    const body = (replies[invoiceId] ?? "").trim();
    if (!body || !user) return;
    setSending((s) => ({ ...s, [invoiceId]: true }));
    try {
      const { error } = await supabase.from("invoice_comments").insert({
        invoice_id: invoiceId,
        author_id: user.id,
        author_role: "client",
        body,
        is_read: false,
      });
      if (error) throw error;
      setReplies((r) => ({ ...r, [invoiceId]: "" }));
      await queryClient.invalidateQueries({ queryKey: ["accountant-threads", clientId] });
    } catch (e) {
      console.error("Failed to send reply:", e);
    } finally {
      setSending((s) => ({ ...s, [invoiceId]: false }));
    }
  };

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
        threads.map((inv: any) => {
          const isResolved = inv.thread_status === "resolved";
          return (
            <div key={inv.id} style={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
              {/* Header */}
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <span style={{ fontWeight: 700, color: "#1e3a5f" }}>{inv.vendor ?? "ספק לא ידוע"}</span>
                  {inv.invoice_number && <span style={{ marginRight: "8px", color: "#64748b", fontSize: "13px" }}>#{inv.invoice_number}</span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  {inv.total && <span style={{ fontWeight: 600, color: "#1e3a5f" }}>{"₪" + Number(inv.total).toLocaleString("he-IL")}</span>}
                  {isResolved ? (
                    <span style={{ padding: "2px 10px", borderRadius: "9999px", fontSize: "12px", fontWeight: 600, backgroundColor: "#e2e8f0", color: "#475569" }}>
                      ✅ הושלם
                    </span>
                  ) : (
                    <span style={{ padding: "2px 10px", borderRadius: "9999px", fontSize: "12px", fontWeight: 600, backgroundColor: "#fef3e2", color: "#d97706" }}>
                      🟡 דרושה הבהרה
                    </span>
                  )}
                  {isAccountant && !isResolved && (
                    <button
                      onClick={() => handleResolve(inv.id)}
                      disabled={!!resolving[inv.id]}
                      style={{
                        padding: "4px 12px",
                        backgroundColor: "#1e3a5f",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "9999px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: resolving[inv.id] ? "not-allowed" : "pointer",
                        opacity: resolving[inv.id] ? 0.6 : 1,
                      }}
                    >
                      {resolving[inv.id] ? "מסמן..." : "✅ סמן כהושלם"}
                    </button>
                  )}
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

              {/* Reply box */}
              {!isResolved && (
                <div style={{ padding: "12px 20px 16px", backgroundColor: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <textarea
                    dir="rtl"
                    placeholder="כתוב תשובה..."
                    value={replies[inv.id] ?? ""}
                    onChange={(e) => setReplies((r) => ({ ...r, [inv.id]: e.target.value }))}
                    rows={3}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                      fontFamily: "inherit",
                      color: "#1e3a5f",
                      resize: "vertical",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    <button
                      onClick={() => handleSend(inv.id)}
                      disabled={!!sending[inv.id] || !(replies[inv.id] ?? "").trim()}
                      style={{
                        padding: "8px 18px",
                        backgroundColor: "#1e3a5f",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "14px",
                        fontWeight: 600,
                        cursor: sending[inv.id] || !(replies[inv.id] ?? "").trim() ? "not-allowed" : "pointer",
                        opacity: sending[inv.id] || !(replies[inv.id] ?? "").trim() ? 0.6 : 1,
                      }}
                    >
                      {sending[inv.id] ? "שולח..." : "שלח תשובה"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
