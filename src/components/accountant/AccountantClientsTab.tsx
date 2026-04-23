import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useClientInvoiceCounts } from "@/hooks/useAccountantData";
import { Search } from "lucide-react";

interface Props {
  clients: any[];
  clientIds: string[];
}

export function AccountantClientsTab({ clients, clientIds }: Props) {
  const [search, setSearch] = useState("");
  const { data: counts = {} } = useClientInvoiceCounts(clientIds);
  const navigate = useNavigate();

  const filtered = clients.filter((c: any) =>
    !search ||
    (c.brand_name ?? "").includes(search) ||
    (c.vat_number ?? "").includes(search)
  );

  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#1e3a5f", margin: 0 }}>כל הלקוחות שלי</h2>
        <div style={{ position: "relative" }}>
          <Search size={16} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש שם / ח״פ..."
            style={{
              paddingRight: "34px", paddingLeft: "12px", paddingTop: "8px", paddingBottom: "8px",
              border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "14px",
              fontFamily: "Heebo, sans-serif", width: "220px", outline: "none",
            }}
          />
        </div>
      </div>

      <div style={{ overflow: "hidden", width: "100%" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", tableLayout: "fixed" }}>
          <thead>
            <tr style={{ backgroundColor: "#f8fafc" }}>
              {["שם עסק", "ח\"פ", "סטטוס", "חודש נוכחי", "ממתין", "הבהרה", "פעולה"].map(h => (
                <th key={h} style={{ padding: "12px", textAlign: "right", fontSize: "12px", fontWeight: 600, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "#94a3b8" }}>אין תוצאות</td></tr>
            )}
            {filtered.map((c: any) => {
              const cc = (counts as any)[c.id] ?? { monthlyTotal: 0, pending: 0, clarification: 0 };
              return (
                <tr key={c.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "12px", fontWeight: 500, color: "#1e3a5f" }}>{c.brand_name ?? "—"}</td>
                  <td style={{ padding: "12px", color: "#64748b" }}>{c.vat_number ?? "—"}</td>
                  <td style={{ padding: "12px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: "9999px",
                        fontSize: "11px",
                        fontWeight: 600,
                        backgroundColor: c.is_active ? "#dcfce7" : "#fee2e2",
                        color: c.is_active ? "#16a34a" : "#dc2626",
                      }}
                    >
                      {c.is_active ? "פעיל" : "מושהה"}
                    </span>
                  </td>
                  <td style={{ padding: "12px" }}>{"₪" + (cc.monthlyTotal ?? 0).toLocaleString("he-IL", { maximumFractionDigits: 0 })}</td>
                  <td style={{ padding: "12px", color: cc.pending > 0 ? "#dc2626" : "#64748b", fontWeight: cc.pending > 0 ? 700 : 400 }}>{cc.pending}</td>
                  <td style={{ padding: "12px", color: cc.clarification > 0 ? "#d97706" : "#64748b", fontWeight: cc.clarification > 0 ? 700 : 400 }}>{cc.clarification}</td>
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
  );
}
