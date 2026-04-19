import { useAccountantKPIs, useClientInvoiceCounts } from "@/hooks/useAccountantData";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

interface Props {
  clients: any[];
  clientIds: string[];
}

export function AccountantHomeTab({ clients, clientIds }: Props) {
  const { data: kpis, isLoading: kpisLoading } = useAccountantKPIs(clientIds);
  const { data: counts = {} } = useClientInvoiceCounts(clientIds);
  const [filterUrgent, setFilterUrgent] = useState(false);
  const navigate = useNavigate();

  const fmt = (n: number) => "₪" + n.toLocaleString("he-IL", { maximumFractionDigits: 0 });

  const kpiCards = [
    { label: "לקוחות פעילים", value: clients.filter((c: any) => c.is_active).length, color: "#1e3a5f" },
    { label: "חשבוניות לבדיקה", value: kpis?.pendingReview ?? 0, color: "#dc2626" },
    { label: "הבהרות פתוחות", value: kpis?.needsClarification ?? 0, color: "#d97706" },
    { label: "בארכיון החודש", value: kpis?.archivedThisMonth ?? 0, color: "#16a34a" },
    { label: "סה\"כ הוצאות החודש", value: fmt(kpis?.totalExpenses ?? 0), color: "#1e3a5f", isText: true },
  ];

  const displayedClients = filterUrgent
    ? clients.filter((c: any) => {
        const cc = (counts as any)[c.id];
        return cc && (cc.pending > 0 || cc.clarification > 0);
      })
    : clients;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
        {kpiCards.map((k, i) => (
          <div
            key={i}
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              padding: "18px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px" }}>{k.label}</div>
            <div style={{ fontSize: k.isText ? "20px" : "28px", fontWeight: 700, color: k.color }}>
              {kpisLoading ? "..." : k.value}
            </div>
          </div>
        ))}
      </div>

      {/* Clients Table */}
      <div style={{ backgroundColor: "#ffffff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#1e3a5f", margin: 0 }}>הלקוחות שלי</h2>
          <button
            onClick={() => setFilterUrgent(f => !f)}
            style={{
              padding: "6px 14px", borderRadius: "6px", fontSize: "13px", cursor: "pointer",
              border: "1px solid #e8941a",
              backgroundColor: filterUrgent ? "#e8941a" : "transparent",
              color: filterUrgent ? "#ffffff" : "#e8941a",
              fontFamily: "Heebo, sans-serif",
            }}
          >
            {filterUrgent ? "הצג הכל" : "🔴 צריך טיפול"}
          </button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc" }}>
                {["שם עסק", "חודש נוכחי", "ממתין", "הבהרה", "ארכיון", "פעולה"].map(h => (
                  <th key={h} style={{ padding: "12px", textAlign: "right", fontSize: "12px", fontWeight: 600, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayedClients.length === 0 && (
                <tr><td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "#94a3b8" }}>אין לקוחות להצגה</td></tr>
              )}
              {displayedClients.map((c: any) => {
                const cc = (counts as any)[c.id] ?? { monthlyTotal: 0, pending: 0, clarification: 0, archived: 0 };
                return (
                  <tr key={c.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px", fontWeight: 500, color: "#1e3a5f" }}>{c.brand_name ?? "—"}</td>
                    <td style={{ padding: "12px" }}>{"₪" + (cc.monthlyTotal ?? 0).toLocaleString("he-IL", { maximumFractionDigits: 0 })}</td>
                    <td style={{ padding: "12px" }}>
                      <span style={{ color: cc.pending > 0 ? "#dc2626" : "#64748b", fontWeight: cc.pending > 0 ? 700 : 400 }}>
                        {cc.pending > 0 ? `🔴 ${cc.pending}` : "0"}
                      </span>
                    </td>
                    <td style={{ padding: "12px" }}>
                      <span style={{ color: cc.clarification > 0 ? "#d97706" : "#64748b", fontWeight: cc.clarification > 0 ? 700 : 400 }}>
                        {cc.clarification > 0 ? `🟡 ${cc.clarification}` : "0"}
                      </span>
                    </td>
                    <td style={{ padding: "12px" }}>{cc.archived}</td>
                    <td style={{ padding: "12px" }}>
                      <button
                        onClick={() => navigate(`/accountant/client/${c.id}`)}
                        style={{
                          padding: "6px 14px", borderRadius: "6px", fontSize: "13px",
                          backgroundColor: "#1e3a5f", color: "#ffffff",
                          border: "none", cursor: "pointer", fontFamily: "Heebo, sans-serif",
                        }}
                      >
                        👁️ כניסה
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
