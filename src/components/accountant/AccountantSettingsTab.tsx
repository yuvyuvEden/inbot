import { Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function AccountantSettingsTab() {
  const { session } = useAuth();
  const email = session?.user?.email ?? "";
  const name = session?.user?.user_metadata?.full_name ?? "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ backgroundColor: "#ffffff", borderRadius: "12px", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#1e3a5f", marginTop: 0, marginBottom: "16px" }}>פרטי משרד</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
          <div>
            <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>שם</div>
            <p style={{ fontSize: "14px", fontWeight: 500, color: "#1e3a5f", margin: 0 }}>{name || "—"}</p>
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>מייל</div>
            <p style={{ fontSize: "14px", fontWeight: 500, color: "#1e3a5f", margin: 0 }}>{email}</p>
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: "#ffffff", borderRadius: "12px", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <Settings size={20} color="#1e3a5f" />
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#1e3a5f", margin: 0 }}>הגדרות מקצועיות</h2>
        </div>
        <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
          העדפות התראה, חתימת מייל, קטגוריות מועדפות — בקרוב
        </p>
      </div>
    </div>
  );
}
