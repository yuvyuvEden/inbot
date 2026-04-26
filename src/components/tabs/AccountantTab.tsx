import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MessageSquare } from "lucide-react";

interface Props { clientId: string; isAccountant?: boolean; }

interface Thread {
  invoiceId: string;
  invoice: any;
  comments: any[];
  lastMessageAt: string;
  clientHasReplied: boolean;
  isResolved: boolean;
  hasUnreadAccountantMessage: boolean;
}

const PAGE_SIZE = 25;

export function AccountantTab({ clientId }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [view, setView] = useState<"inbox" | "thread">("inbox");
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [filter, setFilter] = useState<"received" | "sent" | "all">("received");
  const [page, setPage] = useState(0);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ["accountant-threads", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data: invoices, error } = await supabase
        .from("invoices")
        .select(`
          id, vendor, invoice_number, total, status, drive_file_url, is_archived,
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
  }, [clientId, queryClient]);

  const threads: Thread[] = useMemo(() => {
    const list: Thread[] = (data ?? []).map((inv: any) => {
      const sorted = [...(inv.invoice_comments ?? [])].sort(
        (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const lastAccountantMsg = sorted.filter((c: any) => c.author_role === "accountant").slice(-1)[0];
      const clientHasReplied = lastAccountantMsg
        ? sorted.some(
            (c: any) =>
              c.author_role === "client" &&
              new Date(c.created_at) > new Date(lastAccountantMsg.created_at)
          )
        : false;
      const isResolved = inv.thread_status === "resolved" || inv.status === "approved";
      return {
        invoiceId: inv.id,
        invoice: inv,
        comments: sorted,
        lastMessageAt: sorted[sorted.length - 1]?.created_at,
        clientHasReplied,
        isResolved,
        hasUnreadAccountantMessage: sorted.some(
          (c: any) => c.author_role === "accountant" && !c.is_read
        ),
      };
    });
    list.sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );
    return list;
  }, [data]);

  const filteredThreads = useMemo(() => {
    if (filter === "received")
      return threads.filter((t) => !t.clientHasReplied && !t.isResolved);
    if (filter === "sent")
      return threads.filter((t) => t.clientHasReplied && !t.isResolved);
    return threads;
  }, [threads, filter]);

  const pagedThreads = filteredThreads.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["accountant-threads", clientId] });
    queryClient.invalidateQueries({ queryKey: ["unread-comments", clientId] });
  };

  const markThreadAsRead = async (thread: Thread) => {
    const unreadIds = thread.comments
      .filter((c: any) => c.author_role === "accountant" && !c.is_read)
      .map((c: any) => c.id);
    if (!unreadIds.length) return;
    await supabase.from("invoice_comments").update({ is_read: true }).in("id", unreadIds);
    invalidateAll();
  };

  const handleSend = async (invoiceId: string) => {
    const body = replyText.trim();
    if (!body || !user || sending) return;
    setSending(true);
    setReplyText("");
    try {
      const { error } = await supabase.from("invoice_comments").insert({
        invoice_id: invoiceId,
        author_id: user.id,
        author_role: "client",
        body,
        is_read: false,
      });
      if (error) throw error;

      try {
        const { error: notifyError } = await supabase.functions.invoke("client-reply-notify", {
          body: { invoice_id: invoiceId, comment_body: body },
        });
        if (notifyError) console.error("client-reply-notify failed:", notifyError);
      } catch (notifyErr) {
        console.error("client-reply-notify exception:", notifyErr);
      }
    } catch (e) {
      console.error("Failed to send reply:", e);
      setReplyText(body);
    } finally {
      setSending(false);
      setTimeout(() => invalidateAll(), 500);
      setFilter("sent");
      setView("inbox");
      setSelectedThread(null);
    }
  };

  const containerStyle: React.CSSProperties = {
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
  };

  if (isLoading) {
    return (
      <div style={{ ...containerStyle, padding: "24px", margin: "24px" }}>
        <p style={{ color: "#64748b" }}>טוען...</p>
      </div>
    );
  }

  // ============== THREAD VIEW ==============
  if (view === "thread" && selectedThread) {
    const t = selectedThread;
    return (
      <div style={{ padding: "24px" }}>
        <div style={containerStyle}>
          <button
            onClick={() => { setView("inbox"); setSelectedThread(null); setReplyText(""); }}
            style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", cursor: "pointer", color: "#1e3a5f", fontWeight: 600, fontSize: "14px", padding: "12px 20px", fontFamily: "Heebo, sans-serif" }}
          >
            ← חזרה להודעות
          </button>

          <div style={{ padding: "0 20px 12px 20px", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <MessageSquare size={18} color="#1e3a5f" />
              <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#1e3a5f", margin: 0 }}>
                {t.invoice?.vendor} #{t.invoice?.invoice_number}
              </h2>
              {t.isResolved && (
                <span style={{ fontSize: "11px", background: "#dcfce7", color: "#16a34a", padding: "2px 8px", borderRadius: "10px" }}>✅ הושלם</span>
              )}
            </div>
          </div>

          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {t.comments.map((comment: any) => {
              const isAccountant = comment.author_role === "accountant";
              return (
                <div
                  key={comment.id}
                  style={{
                    display: "flex",
                    justifyContent: isAccountant ? "flex-start" : "flex-end",
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "85%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      backgroundColor: isAccountant ? "#ffffff" : "#e0f2fe",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px", gap: "12px", flexWrap: "wrap" }}>
                      <div style={{ fontSize: "12px", color: isAccountant ? "#1e40af" : "#0369a1", fontWeight: 600 }}>
                        {isAccountant ? 'רו"ח' : "אתה"}
                      </div>
                      <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                        {new Date(comment.created_at).toLocaleString("he-IL")}
                      </div>
                    </div>
                    <p style={{ margin: 0, color: "#334155", fontSize: "13px", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                      {comment.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {!t.isResolved && (
            <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0" }}>
              <textarea
                dir="rtl"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="כתוב תשובה לרואה החשבון..."
                style={{ width: "100%", minHeight: "70px", padding: "8px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px", fontFamily: "Heebo, sans-serif", boxSizing: "border-box", resize: "vertical" }}
              />
              <button
                onClick={() => handleSend(t.invoiceId)}
                disabled={sending || !replyText.trim()}
                style={{ marginTop: "8px", padding: "8px 20px", borderRadius: "8px", backgroundColor: "#1e3a5f", color: "#ffffff", border: "none", cursor: sending ? "not-allowed" : "pointer", fontSize: "13px", fontFamily: "Heebo, sans-serif", fontWeight: 600, opacity: sending || !replyText.trim() ? 0.6 : 1 }}
              >
                {sending ? "שולח..." : "שלח תשובה"}
              </button>

              {t.invoice?.drive_file_url && (
                <div style={{ display: "flex", gap: "8px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #e2e8f0", flexWrap: "wrap" }}>
                  <a
                    href={t.invoice.drive_file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ padding: "6px 14px", borderRadius: "6px", backgroundColor: "#f1f5f9", color: "#1e3a5f", fontSize: "12px", fontWeight: 600, textDecoration: "none", fontFamily: "Heebo, sans-serif", border: "1px solid #e2e8f0" }}
                  >
                    📄 צפה במסמך
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============== INBOX VIEW ==============
  return (
    <div style={{ padding: "24px" }}>
      <div style={containerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "16px 20px", borderBottom: "1px solid #e2e8f0" }}>
          <MessageSquare size={20} color="#1e3a5f" />
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#1e3a5f", margin: 0 }}>הודעות מרואה החשבון</h2>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", gap: "6px" }}>
            {[
              { key: "received", label: "התקבלו" },
              { key: "sent", label: "נשלחו" },
              { key: "all", label: "הכל" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => { setFilter(f.key as any); setPage(0); }}
                style={{ padding: "5px 12px", borderRadius: "6px", fontSize: "12px", fontFamily: "Heebo, sans-serif", border: "none", cursor: "pointer", fontWeight: filter === f.key ? 700 : 400, background: filter === f.key ? "#1e3a5f" : "#f1f5f9", color: filter === f.key ? "#ffffff" : "#64748b" }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "13px", color: "#64748b" }}>
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "3px 10px", cursor: "pointer", opacity: page === 0 ? 0.4 : 1 }}
            >›</button>
            <span>{page + 1}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * PAGE_SIZE >= filteredThreads.length}
              style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "3px 10px", cursor: "pointer", opacity: (page + 1) * PAGE_SIZE >= filteredThreads.length ? 0.4 : 1 }}
            >‹</button>
          </div>
        </div>

        {pagedThreads.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 16px" }}>
            <p style={{ color: "#64748b", fontSize: "14px", margin: 0 }}>אין הודעות 🎉</p>
          </div>
        ) : (
          <div>
            {pagedThreads.map((thread) => (
              <div
                key={thread.invoiceId}
                onClick={() => {
                  setSelectedThread(thread);
                  setView("thread");
                  setReplyText("");
                  markThreadAsRead(thread);
                }}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 20px",
                  borderBottom: "1px solid #f1f5f9",
                  cursor: "pointer",
                  background: thread.hasUnreadAccountantMessage ? "#fffbeb" : "#ffffff",
                  borderRight: thread.hasUnreadAccountantMessage ? "4px solid #e8941a" : "4px solid transparent",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                onMouseLeave={(e) => (e.currentTarget.style.background = thread.hasUnreadAccountantMessage ? "#fffbeb" : "#ffffff")}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: thread.hasUnreadAccountantMessage ? 700 : 500, color: "#1e3a5f", fontSize: "14px" }}>
                      {thread.invoice?.vendor} #{thread.invoice?.invoice_number}
                    </span>
                    {thread.isResolved && (
                      <span style={{ fontSize: "11px", background: "#dcfce7", color: "#16a34a", padding: "1px 8px", borderRadius: "10px" }}>✅ הושלם</span>
                    )}
                  </div>
                  <div style={{ fontSize: "13px", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {thread.comments[thread.comments.length - 1]?.body}
                  </div>
                </div>
                <div style={{ fontSize: "11px", color: "#94a3b8", marginRight: "12px", flexShrink: 0 }}>
                  {thread.lastMessageAt && new Date(thread.lastMessageAt).toLocaleDateString("he-IL")}
                </div>
                <span style={{ color: "#94a3b8", fontSize: "18px" }}>›</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
