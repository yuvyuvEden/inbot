import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AccountantHomeTab } from "@/components/accountant/AccountantHomeTab";
import { AccountantClientsTab } from "@/components/accountant/AccountantClientsTab";
import { AccountantMessagesTab } from "@/components/accountant/AccountantMessagesTab";
import { AccountantSettingsTab } from "@/components/accountant/AccountantSettingsTab";
import { useMyClients } from "@/hooks/useAccountantData";
import { LogOut, ShieldAlert, Home, Users, MessageSquare, Settings } from "lucide-react";

const LOGO_URL = "https://jkqpkbcdtbelgpuwncam.supabase.co/storage/v1/object/public/assets//LOGO.jpeg";

const TABS = [
  { id: "home", label: "🏠 בית" },
  { id: "clients", label: "📋 לקוחות" },
  { id: "messages", label: "📨 הודעות" },
  { id: "settings", label: "⚙️ הגדרות" },
];

export default function AccountantDashboard() {
  const { session, signOut, userRole } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("home");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const adminViewId = searchParams.get("admin_view");
  const isAdminView = userRole === "admin" && !!adminViewId;
  const adminViewName = sessionStorage.getItem("admin_view_name") ?? "";

  const { data: clients = [] } = useMyClients(
    isAdminView ? adminViewId : undefined
  );
  const clientIds = (clients as any[]).map((c: any) => c.id);

  const accountantName = session?.user?.user_metadata?.full_name ?? "רואה חשבון";

  const exitAdminView = () => {
    sessionStorage.removeItem("admin_view_id");
    sessionStorage.removeItem("admin_view_name");
    sessionStorage.removeItem("admin_view_path");
    navigate("/admin");
  };

  return (
    <div dir="rtl" lang="he" style={{ minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "Heebo, sans-serif" }}>
      {/* Admin View Banner */}
      {isAdminView && (
        <div style={{
          backgroundColor: "#fef3c7",
          borderBottom: "2px solid #e8941a",
          padding: "10px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <ShieldAlert size={18} color="#b45309" />
            <span style={{ color: "#854d0e", fontSize: "14px", fontWeight: 700 }}>
              מצב תמיכה — צופה כ: {adminViewName}
            </span>
            <span style={{ color: "#92400e", fontSize: "12px" }}>
              (קריאה בלבד — הפעולות מושבתות)
            </span>
          </div>
          <button
            onClick={exitAdminView}
            style={{
              padding: "6px 14px", borderRadius: "6px", fontSize: "13px",
              backgroundColor: "#1e3a5f", color: "#ffffff",
              border: "none", cursor: "pointer",
              fontFamily: "Heebo, sans-serif",
            }}
          >
            ← חזרה לאדמין
          </button>
        </div>
      )}

      {/* Navbar */}
      <nav
        style={{
          height: "60px",
          backgroundColor: "#1e3a5f",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img
            src={LOGO_URL}
            alt="INBOT"
            onClick={() => setActiveTab("home")}
            style={{ height: "36px", borderRadius: "4px", cursor: "pointer" }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <span style={{ color: "#e8941a", fontSize: "13px", fontWeight: 600 }}>רו"ח</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ color: "rgba(255,255,255,0.85)", fontSize: "13px" }}>שלום, {accountantName}</span>
          {!isAdminView && (
            <button
              onClick={signOut}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.3)",
                background: "transparent",
                color: "#ffffff",
                fontSize: "12px",
                cursor: "pointer",
                fontFamily: "Heebo, sans-serif",
              }}
            >
              <LogOut size={14} />
              התנתק
            </button>
          )}
        </div>
      </nav>

      {/* Tab Bar */}
      <div style={{ backgroundColor: "#ffffff", borderBottom: "1px solid #e2e8f0", display: isMobile ? "none" : "flex", gap: "4px", padding: "0 16px", overflowX: "auto" }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "14px 20px",
              background: "none",
              border: "none",
              borderBottom: activeTab === tab.id ? "3px solid #e8941a" : "3px solid transparent",
              color: activeTab === tab.id ? "#1e3a5f" : "#64748b",
              fontWeight: activeTab === tab.id ? 700 : 400,
              fontSize: "14px",
              cursor: "pointer",
              fontFamily: "Heebo, sans-serif",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <main style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
        {activeTab === "home" && <AccountantHomeTab clients={clients as any[]} clientIds={clientIds} />}
        {activeTab === "clients" && <AccountantClientsTab clients={clients as any[]} clientIds={clientIds} />}
        {activeTab === "messages" && <AccountantMessagesTab clientIds={clientIds} />}
        {activeTab === "settings" && <AccountantSettingsTab />}
      </main>
    </div>
  );
}
