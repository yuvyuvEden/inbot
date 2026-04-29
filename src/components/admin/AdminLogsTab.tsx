import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type LogTab = "usage" | "email" | "billing" | "ai_errors" | "audit";

export default function AdminLogsTab() {
  const [activeTab, setActiveTab] = useState<LogTab>("usage");
  const [search, setSearch] = useState("");

  const { data: usageLogs = [], isLoading: usageLoading } = useQuery({
    queryKey: ["usage-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usage_log")
        .select("*, clients(brand_name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: emailLogs = [], isLoading: emailLoading } = useQuery({
    queryKey: ["email-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_send_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: billingLogs = [], isLoading: billingLoading } = useQuery({
    queryKey: ["billing-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: aiErrors = [], isLoading: aiErrorsLoading } = useQuery({
    queryKey: ["ai-errors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_processing_errors")
        .select("*, clients(brand_name)")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  const tabs: { key: LogTab; label: string }[] = [
    { key: "usage", label: "פעולות לקוחות" },
    { key: "email", label: "מיילים" },
    { key: "billing", label: "חיובים" },
    { key: "ai_errors", label: "🔴 שגיאות AI" },
  ];

  const isLoading = usageLoading || emailLoading || billingLoading || aiErrorsLoading;

  const formatDate = (d: string) =>
    new Date(d).toLocaleString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const statusColor = (s: string) => {
    if (s === "sent" || s === "paid" || s === "success") return "#16a34a";
    if (s === "failed" || s === "error" || s === "dlq") return "#dc2626";
    return "#e8941a";
  };

  const thStyle: React.CSSProperties = {
    padding: "10px 12px",
    fontSize: "12px",
    fontWeight: 600,
    color: "#64748b",
    textAlign: "right",
    borderBottom: "1px solid #e2e8f0",
    background: "#f8fafc",
  };
  const tdStyle: React.CSSProperties = {
    padding: "10px 12px",
    fontSize: "13px",
    color: "#1e293b",
    borderBottom: "1px solid #f1f5f9",
    textAlign: "right",
  };

  const badgeStyle = (color: string): React.CSSProperties => ({
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: 600,
    background: `${color}22`,
    color,
  });

  return (
    <div dir="rtl" style={{ fontFamily: "Heebo, sans-serif" }}>
      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#1e3a5f", margin: 0 }}>
          לוגי מערכת
        </h2>
        <p style={{ fontSize: "13px", color: "#64748b", margin: "4px 0 0" }}>
          200 הרשומות האחרונות לכל קטגוריה
        </p>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "16px", flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setActiveTab(t.key);
              setSearch("");
            }}
            style={{
              padding: "8px 20px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              background: activeTab === t.key ? "#1e3a5f" : "transparent",
              color: activeTab === t.key ? "#ffffff" : "#64748b",
              border: activeTab === t.key ? "none" : "1px solid #e2e8f0",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש..."
          style={{
            marginRight: "auto",
            padding: "8px 14px",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            fontSize: "13px",
            width: "200px",
            direction: "rtl",
          }}
        />
      </div>

      {isLoading && <div style={{ padding: "20px", color: "#64748b" }}>טוען...</div>}

      {/* Usage Logs */}
      {activeTab === "usage" && !usageLoading && (
        <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["תאריך", "לקוח", "פעולה", "כמות"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usageLogs
                .filter((r: any) =>
                  !search ||
                  (r.clients?.brand_name ?? "").includes(search) ||
                  r.action.includes(search)
                )
                .map((r: any) => (
                  <tr key={r.id}>
                    <td style={tdStyle}>{formatDate(r.created_at)}</td>
                    <td style={tdStyle}>{r.clients?.brand_name ?? r.client_id}</td>
                    <td style={tdStyle}>{r.action}</td>
                    <td style={tdStyle}>{r.count}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Email Logs */}
      {activeTab === "email" && !emailLoading && (
        <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["תאריך", "נמען", "תבנית", "סטטוס", "שגיאה"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {emailLogs
                .filter((r: any) =>
                  !search ||
                  r.recipient_email.includes(search) ||
                  r.template_name.includes(search) ||
                  r.status.includes(search)
                )
                .map((r: any) => (
                  <tr key={r.id}>
                    <td style={tdStyle}>{formatDate(r.created_at)}</td>
                    <td style={tdStyle}>{r.recipient_email}</td>
                    <td style={tdStyle}>{r.template_name}</td>
                    <td style={tdStyle}>
                      <span style={badgeStyle(statusColor(r.status))}>{r.status}</span>
                    </td>
                    <td style={{ ...tdStyle, color: "#dc2626", fontSize: "12px" }}>
                      {r.error_message ?? "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Billing Logs */}
      {activeTab === "billing" && !billingLoading && (
        <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["תאריך", "ישות", "סוג", "סטטוס", "סכום כולל מע״מ", "תקופה"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {billingLogs
                .filter((r: any) =>
                  !search ||
                  r.entity_type.includes(search) ||
                  r.status.includes(search) ||
                  r.billing_period.includes(search)
                )
                .map((r: any) => (
                  <tr key={r.id}>
                    <td style={tdStyle}>{formatDate(r.created_at)}</td>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "11px" }}>{r.entity_id}</td>
                    <td style={tdStyle}>{r.entity_type}</td>
                    <td style={tdStyle}>
                      <span style={badgeStyle(statusColor(r.status))}>{r.status}</span>
                    </td>
                    <td style={tdStyle}>
                      ₪{(r.total_with_vat ?? 0).toLocaleString("he-IL")}
                    </td>
                    <td style={tdStyle}>{r.billing_period}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "ai_errors" && (
        <div style={{ overflowX: "auto" }}>
          {aiErrors.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "#16a34a", fontSize: "14px", fontFamily: "Heebo, sans-serif" }}>
              ✅ אין שגיאות AI — הכל תקין
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", fontFamily: "Heebo, sans-serif" }}>
              <thead>
                <tr style={{ background: "#fef2f2" }}>
                  {["תאריך", "לקוח", "מקור", "סוג שגיאה", "ספק", "שם קובץ", "הודעה"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "right", fontSize: "11px", color: "#dc2626", fontWeight: 600, borderBottom: "1px solid #fecaca" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {aiErrors
                  .filter((e: any) =>
                    !search ||
                    (e.clients?.brand_name ?? "").includes(search) ||
                    (e.error_type ?? "").includes(search) ||
                    (e.vendor ?? "").includes(search) ||
                    (e.error_msg ?? "").includes(search)
                  )
                  .map((e: any) => (
                    <tr key={e.id} style={{ borderBottom: "1px solid #fef2f2" }}
                      onMouseEnter={ev => (ev.currentTarget.style.background = "#fef2f2")}
                      onMouseLeave={ev => (ev.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "8px 12px", color: "#64748b", whiteSpace: "nowrap" }}>{formatDate(e.created_at)}</td>
                      <td style={{ padding: "8px 12px", fontWeight: 600, color: "#1e3a5f" }}>{e.clients?.brand_name ?? "—"}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <span style={{
                          background: e.source === "gmail" ? "#eff6ff" : "#f0fdf4",
                          color: e.source === "gmail" ? "#1e40af" : "#16a34a",
                          padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: 600
                        }}>
                          {e.source ?? "—"}
                        </span>
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        <span style={{
                          background: "#fef2f2", color: "#dc2626",
                          padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: 600
                        }}>
                          {e.error_type ?? "—"}
                        </span>
                      </td>
                      <td style={{ padding: "8px 12px", color: "#475569" }}>{e.vendor ?? "—"}</td>
                      <td style={{ padding: "8px 12px", color: "#475569", direction: "ltr" }}>{e.file_name ?? "—"}</td>
                      <td style={{ padding: "8px 12px", color: "#64748b", maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={e.error_msg ?? ""}>{e.error_msg ?? "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
