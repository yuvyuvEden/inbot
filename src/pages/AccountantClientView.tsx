import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowRight, LogOut } from "lucide-react";
import KPICards from "@/components/dashboard/KPICards";
import ExpenseChart from "@/components/dashboard/ExpenseChart";
import CategoryPieChart from "@/components/dashboard/CategoryPieChart";
import InvoicesTab from "@/components/dashboard/InvoicesTab";
import { ArchiveTab } from "@/components/tabs/ArchiveTab";
import { AccountantTab } from "@/components/tabs/AccountantTab";
import {
  useInvoiceKPIs,
  useInvoiceKPIsDelta,
  useExpenseTimeline,
  useCategoryBreakdown,
} from "@/hooks/useClientData";

const TABS = [
  { id: "dashboard", label: "📊 דשבורד" },
  { id: "invoices", label: "📄 חשבוניות" },
  { id: "messages", label: "💬 הודעות" },
  { id: "archive", label: "🗄️ ארכיון" },
];

const PERIODS = [
  { value: "this_month", label: "החודש" },
  { value: "last_month", label: "חודש קודם" },
  { value: "this_quarter", label: "רבעון" },
  { value: "this_year", label: "השנה" },
];

export default function AccountantClientView() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { session, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [period, setPeriod] = useState("this_month");

  const accountantName = session?.user?.user_metadata?.full_name ?? "רואה חשבון";

  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ["accountant-client-record", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, brand_name, legal_name, vat_number, is_active")
        .eq("id", clientId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: isAuthorized } = useQuery({
    queryKey: ["accountant-auth-check", clientId],
    enabled: !!clientId && !!session?.user?.id,
    queryFn: async () => {
      const { data: accountant } = await supabase
        .from("accountants")
        .select("id")
        .eq("user_id", session!.user.id)
        .single();
      if (!accountant) return false;

      const { data: assignment } = await supabase
        .from("accountant_clients")
        .select("id")
        .eq("accountant_id", accountant.id)
        .eq("client_id", clientId!)
        .is("unassigned_at", null)
        .maybeSingle();

      return !!assignment;
    },
  });

  const { data: kpis, isLoading: kpisLoading } = useInvoiceKPIs(clientId, period);
  const { data: prevKpis } = useInvoiceKPIsDelta(clientId, period);
  const { data: timeline, isLoading: timelineLoading } = useExpenseTimeline(clientId, period);
  const { data: categories, isLoading: catLoading } = useCategoryBreakdown(clientId, period);

  if (clientLoading) {
    return (
      <div dir="rtl" lang="he" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Heebo, sans-serif", color: "#1e3a5f" }}>
        <p>טוען...</p>
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div dir="rtl" lang="he" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", fontFamily: "Heebo, sans-serif", backgroundColor: "#f8fafc" }}>
        <h1 style={{ color: "#dc2626", fontSize: "20px", fontWeight: 700 }}>אין הרשאה לצפות בלקוח זה</h1>
        <button
          onClick={() => navigate("/accountant")}
          style={{ padding: "8px 20px", backgroundColor: "#1e3a5f", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontFamily: "Heebo, sans-serif" }}
        >חזרה לפורטל</button>
      </div>
    );
  }

  return (
    <div dir="rtl" lang="he" style={{ minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "Heebo, sans-serif" }}>
      {/* Navbar */}
      <nav style={{ height: "60px", backgroundColor: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ color: "#ffffff", fontWeight: 700, fontSize: "18px" }}>INBOT</span>
          <button
            onClick={() => navigate("/accountant")}
            style={{ background: "none", border: "1px solid #475569", borderRadius: "6px", padding: "6px 12px", color: "#cbd5e1", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontFamily: "Heebo, sans-serif" }}
          >
            <ArrowRight size={14} />
            הלקוחות שלי
          </button>
          {client && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#ffffff" }}>
              <span style={{ color: "#475569" }}>|</span>
              <span style={{ fontWeight: 700, fontSize: "15px" }}>{client.brand_name ?? "לקוח"}</span>
              {client.vat_number && (
                <span style={{ color: "#94a3b8", fontSize: "12px" }}>ח"פ {client.vat_number}</span>
              )}
              <span style={{
                fontSize: "11px", padding: "2px 8px", borderRadius: "10px",
                backgroundColor: client.is_active ? "#16a34a" : "#64748b",
                color: "#ffffff"
              }}>
                {client.is_active ? "פעיל" : "מושהה"}
              </span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ color: "#cbd5e1", fontSize: "13px" }}>{accountantName}</span>
          <button
            onClick={signOut}
            style={{ background: "none", border: "1px solid #475569", borderRadius: "6px", padding: "6px 12px", color: "#cbd5e1", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontFamily: "Heebo, sans-serif" }}
          >
            <LogOut size={14} />
            התנתק
          </button>
        </div>
      </nav>

      {/* Tab Bar + Period Selector */}
      <div style={{ backgroundColor: "#ffffff", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", paddingLeft: "24px", paddingRight: "24px" }}>
        <div style={{ display: "flex", gap: "4px" }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "14px 20px", background: "none", border: "none",
                borderBottom: activeTab === tab.id ? "3px solid #e8941a" : "3px solid transparent",
                color: activeTab === tab.id ? "#1e3a5f" : "#64748b",
                fontWeight: activeTab === tab.id ? 700 : 400,
                fontSize: "14px", cursor: "pointer",
                fontFamily: "Heebo, sans-serif", transition: "all 0.15s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "dashboard" && (
          <div style={{ display: "flex", gap: "4px" }}>
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                style={{
                  padding: "6px 14px", borderRadius: "6px", fontSize: "13px",
                  border: "none", cursor: "pointer", fontFamily: "Heebo, sans-serif",
                  backgroundColor: period === p.value ? "#1e3a5f" : "transparent",
                  color: period === p.value ? "#ffffff" : "#64748b",
                  transition: "all 0.15s",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <main>
        {activeTab === "dashboard" && clientId && (
          <div style={{ padding: "24px" }}>
            <div style={{ backgroundColor: "#fef3c7", borderRight: "4px solid #e8941a", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px" }}>
              <span style={{ color: "#854d0e", fontSize: "13px" }}>
                📋 מצב צפייה: רואה חשבון — ניתן לאשר, לבקש הבהרה ולארכב חשבוניות בטאב חשבוניות
              </span>
            </div>
            <KPICards kpis={kpis} prevKpis={prevKpis} isLoading={kpisLoading} />
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px", marginTop: "20px" }}>
              <ExpenseChart data={timeline} isLoading={timelineLoading} />
              <CategoryPieChart data={categories} isLoading={catLoading} />
            </div>
          </div>
        )}

        {activeTab === "invoices" && clientId && (
          <InvoicesTab clientId={clientId} hasAccountant={true} showAccountantActions={true} />
        )}

        {activeTab === "messages" && clientId && (
          <div style={{ padding: "24px" }}>
            <AccountantTab clientId={clientId} />
          </div>
        )}

        {activeTab === "archive" && clientId && (
          <div style={{ padding: "24px" }}>
            <ArchiveTab clientId={clientId} />
          </div>
        )}
      </main>
    </div>
  );
}
