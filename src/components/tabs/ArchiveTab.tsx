import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Archive } from "lucide-react";
import { useState } from "react";

interface Props { clientId: string; }

export function ArchiveTab({ clientId }: Props) {
  const [search, setSearch] = useState("");

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["archived-invoices", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, vendor, invoice_number, total, category, invoice_date, status")
        .eq("client_id", clientId)
        .eq("is_archived", true)
        .is("deleted_at", null)
        .order("invoice_date", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = invoices.filter((inv: any) =>
    !search ||
    (inv.vendor ?? "").includes(search) ||
    (inv.invoice_number ?? "").includes(search) ||
    (inv.category ?? "").includes(search)
  );

  const fmt = (d: string) => d ? new Date(d).toLocaleDateString("he-IL") : "—";

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Archive size={20} color="#1e3a5f" />
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#1e3a5f", margin: 0 }}>
            ארכיון חשבוניות ({invoices.length})
          </h2>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש בארכיון..."
          style={{
            padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: "8px",
            fontSize: "14px", fontFamily: "Heebo, sans-serif", width: "220px", outline: "none",
          }}
        />
      </div>

      <div style={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
        {isLoading ? (
          <p style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>טוען...</p>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#94a3b8" }}>
            <Archive size={40} color="#cbd5e1" style={{ margin: "0 auto 12px" }} />
            <p style={{ margin: 0 }}>{search ? "אין תוצאות לחיפוש" : "הארכיון ריק"}</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc" }}>
                  {["ספק", "מס' חשבונית", "קטגוריה", "סכום", "תאריך", "סטטוס"].map(h => (
                    <th key={h} style={{ padding: "12px", textAlign: "right", fontSize: "12px", fontWeight: 600, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv: any) => (
                  <tr key={inv.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px", fontWeight: 500, color: "#1e3a5f" }}>{inv.vendor ?? "—"}</td>
                    <td style={{ padding: "12px", color: "#64748b" }}>{inv.invoice_number ?? "—"}</td>
                    <td style={{ padding: "12px", color: "#64748b" }}>{inv.category ?? "—"}</td>
                    <td style={{ padding: "12px", fontWeight: 600 }}>
                      {"₪" + (Number(inv.total) || 0).toLocaleString("he-IL", { maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ padding: "12px", color: "#64748b" }}>{fmt(inv.invoice_date)}</td>
                    <td style={{ padding: "12px" }}>
                      <span style={{ padding: "2px 8px", borderRadius: "9999px", fontSize: "11px", fontWeight: 600, backgroundColor: "#dcfce7", color: "#16a34a" }}>
                        {inv.status === "approved" ? "מאושר" : inv.status ?? "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
