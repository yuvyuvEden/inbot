import { useState, useMemo, useRef } from "react";
import { useAllThreadComments } from "@/hooks/useAccountantData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";

interface Props { clientIds: string[]; }

interface Thread {
  invoiceId: string;
  invoice: any;
  comments: any[];
  lastMessageAt: string;
  hasUnreadClientMessage: boolean;
  accountantHasReplied: boolean;
  isResolved: boolean;
}

const PAGE_SIZE = 25;

export function AccountantMessagesTab({ clientIds }: Props) {
  const queryClient = useQueryClient();
  const { data: comments = [], isLoading } = useAllThreadComments(clientIds);

  const [view, setView] = useState<"inbox" | "thread">("inbox");
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [filter, setFilter] = useState<"all" | "unread" | "unanswered">("unanswered");
  const [page, setPage] = useState(0);

  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef<Record<string, boolean>>({});

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["all-thread-comments"] });
    queryClient.invalidateQueries({ queryKey: ["unread-accountant-comments"] });
  };

  const threads: Thread[] = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    (comments as any[]).forEach((c: any) => {
      if (!grouped[c.invoice_id]) grouped[c.invoice_id] = [];
      grouped[c.invoice_id].push(c);
    });
    const list: Thread[] = Object.entries(grouped).map(([invoiceId, cmts]) => {
      const sorted = [...cmts].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const invoice = sorted[0]?.invoice ?? {};
      const hasUnreadClientMessage = sorted.some(
        (c) => c.author_role === "client" && !c.is_read
      );
      // נענו = יש הודעת רו"ח שנשלחה אחרי ההודעה האחרונה של הלקוח
      const lastClientMessage = sorted.filter((c) => c.author_role === "client").slice(-1)[0];
      const accountantHasReplied = lastClientMessage
        ? sorted.some(
            (c) =>
              c.author_role === "accountant" &&
              new Date(c.created_at) > new Date(lastClientMessage.created_at)
          )
        : true; // אם אין הודעת לקוח — נחשב כנענה
      const isResolved = invoice?.status === "approved" || invoice?.is_archived === true;
      return {
        invoiceId,
        invoice,
        comments: sorted,
        lastMessageAt: sorted[sorted.length - 1]?.created_at,
        hasUnreadClientMessage,
        accountantHasReplied,
        isResolved,
      };
    });
    list.sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );
    return list;
  }, [comments]);

  const filteredThreads = useMemo(() => {
    if (filter === "unanswered")
      return threads.filter((t) => !t.accountantHasReplied && !t.isResolved);
    if (filter === "unread") return threads.filter((t) => t.hasUnreadClientMessage);
    return threads;
  }, [threads, filter]);

  const pagedThreads = filteredThreads.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const markThreadAsRead = async (thread: Thread) => {
    const unreadIds = thread.comments
      .filter((c: any) => c.author_role === "client" && !c.is_read)
      .map((c: any) => c.id);
    if (!unreadIds.length) return;
    await supabase.from("invoice_comments").update({ is_read: true }).in("id", unreadIds);
    invalidateAll();
  };


  const sendReply = async (invoiceId: string) => {
    const text = replyText.trim();
    if (!text || sending || sendingRef.current[invoiceId]) return;

    // נקה טקסט ועדכן סטטוס מיד — מונע כפול
    sendingRef.current[invoiceId] = true;
    setReplyText("");
    setSending(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("invoice_comments").insert({
        invoice_id: invoiceId,
        author_id: user?.id as string,
        author_role: "accountant",
        body: text,
        is_read: false,
      });
      if (error) throw error;

      try {
        await supabase.functions.invoke("accountant-send-email", {
          body: { invoice_id: invoiceId, body: text },
        });
      } catch (emailErr) {
        console.warn("Email failed:", emailErr);
      }
    } catch (err) {
      console.error("Failed to send reply:", err);
      // החזר טקסט אם נכשל
      setReplyText(text);
    } finally {
      sendingRef.current[invoiceId] = false;
      setSending(false);
      // invalidate רק אחרי שהכל הסתיים
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["all-thread-comments"] });
        queryClient.invalidateQueries({ queryKey: ["unread-accountant-comments"] });
      }, 500);
    }
  };


  const approveInvoice = async (invoiceId: string) => {
    await supabase.from("invoices").update({ status: "approved" }).eq("id", invoiceId);
    setView("inbox");
    setSelectedThread(null);
    invalidateAll();
  };

  const archiveInvoice = async (invoiceId: string) => {
    await supabase.from("invoices").update({
      is_archived: true,
      archived_at: new Date().toISOString(),
      status: "approved",
    }).eq("id", invoiceId);
    setView("inbox");
    setSelectedThread(null);
    invalidateAll();
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
      <div style={{ ...containerStyle, padding: "24px" }}>
        <p style={{ color: "#64748b" }}>טוען...</p>
      </div>
    );
  }

  // ============== THREAD VIEW ==============
  if (view === "thread" && selectedThread) {
    const t = selectedThread;
    return (
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
            {t.invoice?.status === "approved" && (
              <span style={{ fontSize: "11px", background: "#dcfce7", color: "#16a34a", padding: "2px 8px", borderRadius: "10px" }}>✅ מאושר</span>
            )}
            {t.invoice?.is_archived && (
              <span style={{ fontSize: "11px", background: "#f1f5f9", color: "#64748b", padding: "2px 8px", borderRadius: "10px" }}>🗄️ ארכיון</span>
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
                    backgroundColor: isAccountant ? "#dbeafe" : "#f1f5f9",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px", gap: "12px", flexWrap: "wrap" }}>
                    <div style={{ fontSize: "12px", color: isAccountant ? "#1e40af" : "#64748b", fontWeight: 600 }}>
                      {isAccountant ? 'רו"ח' : "לקוח"}
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

        <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0" }}>
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="כתוב תשובה ללקוח..."
            style={{ width: "100%", minHeight: "70px", padding: "8px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px", fontFamily: "Heebo, sans-serif", boxSizing: "border-box", resize: "vertical" }}
          />
          <button
            onClick={() => sendReply(t.invoiceId)}
            disabled={sending || !replyText.trim()}
            style={{ marginTop: "8px", padding: "8px 20px", borderRadius: "8px", backgroundColor: "#1e3a5f", color: "#ffffff", border: "none", cursor: sending ? "not-allowed" : "pointer", fontSize: "13px", fontFamily: "Heebo, sans-serif", fontWeight: 600, opacity: sending || !replyText.trim() ? 0.6 : 1 }}
          >
            {sending ? "שולח..." : "שלח תשובה"}
          </button>

          <div style={{ display: "flex", gap: "8px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #e2e8f0", flexWrap: "wrap" }}>
            {t.invoice?.drive_file_url && (
              <a
                href={t.invoice.drive_file_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ padding: "6px 14px", borderRadius: "6px", backgroundColor: "#f1f5f9", color: "#1e3a5f", fontSize: "12px", fontWeight: 600, textDecoration: "none", fontFamily: "Heebo, sans-serif", border: "1px solid #e2e8f0" }}
              >
                📄 צפה במסמך
              </a>
            )}
            {t.invoice?.status !== "approved" && !t.invoice?.is_archived && (
              <button
                onClick={() => approveInvoice(t.invoiceId)}
                style={{ padding: "6px 14px", borderRadius: "6px", backgroundColor: "#16a34a", color: "#ffffff", fontSize: "12px", fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "Heebo, sans-serif" }}
              >
                ✅ אשר
              </button>
            )}
            {!t.invoice?.is_archived && (
              <button
                onClick={() => archiveInvoice(t.invoiceId)}
                style={{ padding: "6px 14px", borderRadius: "6px", backgroundColor: "#64748b", color: "#ffffff", fontSize: "12px", fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "Heebo, sans-serif" }}
              >
                🗄️ ארכיון
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============== INBOX VIEW ==============
  return (
    <div style={containerStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "16px 20px", borderBottom: "1px solid #e2e8f0" }}>
        <MessageSquare size={20} color="#1e3a5f" />
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#1e3a5f", margin: 0 }}>הודעות</h2>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", gap: "6px" }}>
          {[
            { key: "unanswered", label: "טרם נענו" },
            { key: "unread", label: "טרם נקראו" },
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
                background: thread.hasUnreadClientMessage ? "#fffbeb" : "#ffffff",
                borderRight: thread.hasUnreadClientMessage ? "4px solid #e8941a" : "4px solid transparent",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
              onMouseLeave={(e) => (e.currentTarget.style.background = thread.hasUnreadClientMessage ? "#fffbeb" : "#ffffff")}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: thread.hasUnreadClientMessage ? 700 : 500, color: "#1e3a5f", fontSize: "14px" }}>
                    {thread.invoice?.vendor} #{thread.invoice?.invoice_number}
                  </span>
                  {thread.invoice?.status === "approved" && (
                    <span style={{ fontSize: "11px", background: "#dcfce7", color: "#16a34a", padding: "1px 8px", borderRadius: "10px" }}>✅ מאושר</span>
                  )}
                  {thread.invoice?.is_archived && (
                    <span style={{ fontSize: "11px", background: "#f1f5f9", color: "#64748b", padding: "1px 8px", borderRadius: "10px" }}>🗄️ ארכיון</span>
                  )}
                </div>
                <div style={{ fontSize: "13px", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {thread.comments[thread.comments.length - 1]?.body}
                </div>
              </div>
              <div style={{ fontSize: "11px", color: "#94a3b8", marginRight: "12px", flexShrink: 0 }}>
                {new Date(thread.lastMessageAt).toLocaleDateString("he-IL")}
              </div>
              <span style={{ color: "#94a3b8", fontSize: "18px" }}>›</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
