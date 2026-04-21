import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  useClientRecord, useInvoiceKPIs, useInvoiceKPIsDelta,
  useUnreadComments, useExpenseTimeline, useCategoryBreakdown, useRecentInvoices,
} from "@/hooks/useClientData";
import KPICards from "@/components/dashboard/KPICards";
import ExpenseChart from "@/components/dashboard/ExpenseChart";
import CategoryPieChart from "@/components/dashboard/CategoryPieChart";
import RecentInvoicesTable from "@/components/dashboard/RecentInvoicesTable";
import InvoicesTab from "@/components/dashboard/InvoicesTab";
import ExportTab from "@/components/tabs/ExportTab";
import AiChatTab from "@/components/tabs/AiChatTab";
import SettingsTab from "@/components/tabs/SettingsTab";
import { AccountantTab } from "@/components/tabs/AccountantTab";
import { ArchiveTab } from "@/components/tabs/ArchiveTab";
import {
  BarChart2, FileText, MessageSquare, Archive, Download, Bot, Settings, LogOut, ShieldAlert,
} from "lucide-react";

const LOGO_URL = "https://jkqpkbcdtbelgpuwncam.supabase.co/storage/v1/object/public/assets//LOGO.jpeg";

const PERIODS = [
  { key: "this_month", label: "החודש" },
  { key: "last_month", label: "חודש קודם" },
  { key: "this_quarter", label: "רבעון נוכחי" },
  { key: "last_quarter", label: "רבעון קודם" },
  { key: "this_year", label: "השנה" },
] as const;

const TABS = [
  { key: "dashboard", label: "דשבורד", icon: BarChart2 },
  { key: "invoices", label: "חשבוניות", icon: FileText },
  { key: "messages", label: 'הודעות רו"ח', icon: MessageSquare, badge: true },
  { key: "archive", label: "ארכיון", icon: Archive },
  { key: "export", label: "ייצוא", icon: Download },
  { key: "ai", label: "AI Chat", icon: Bot },
  { key: "settings", label: "הגדרות", icon: Settings },
] as const;

export default function Dashboard() {
  const { user, signOut, userRole } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const adminViewId = searchParams.get("admin_view");
  const isAdminView = userRole === "admin" && !!adminViewId;
  const adminViewName = sessionStorage.getItem("admin_view_name") ?? "";

  const { data: clientRecord } = useClientRecord();
  const { data: adminViewClient } = useQuery({
    queryKey: ["admin-view-client", adminViewId],
    enabled: isAdminView && !!adminViewId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, brand_name")
        .eq("id", adminViewId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const effectiveClientId = isAdminView ? adminViewId! : clientRecord?.id;

  const [activeTab, setActiveTab] = useState("dashboard");
  const [period, setPeriod] = useState("this_month");
  const { data: kpis, isLoading: kpisLoading } = useInvoiceKPIs(effectiveClientId, period);
  const { data: prevKpis } = useInvoiceKPIsDelta(effectiveClientId, period);
  const { data: unreadCount } = useUnreadComments(effectiveClientId);
  const { data: timeline, isLoading: timelineLoading } = useExpenseTimeline(effectiveClientId, period);
  const { data: categories, isLoading: categoriesLoading } = useCategoryBreakdown(effectiveClientId, period);
  const { data: recentInvoices, isLoading: recentLoading } = useRecentInvoices(effectiveClientId);

  const { data: hasAccountant } = useQuery({
    queryKey: ["has-accountant", effectiveClientId],
    enabled: !!effectiveClientId,
    queryFn: async () => {
      const { count } = await supabase
        .from("accountant_clients")
        .select("id", { count: "exact", head: true })
        .eq("client_id", effectiveClientId!);
      return (count ?? 0) > 0;
    },
  });

  const exitAdminView = () => {
    sessionStorage.removeItem("admin_view_id");
    sessionStorage.removeItem("admin_view_name");
    sessionStorage.removeItem("admin_view_path");
    navigate("/admin");
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background font-sans">
      {/* Admin View Banner */}
      {isAdminView && (
        <div style={{
          backgroundColor: "#fef3c7",
          borderBottom: "2px solid #e8941a",
          padding: "10px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: "Heebo, sans-serif",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <ShieldAlert size={18} color="#b45309" />
            <span style={{ color: "#854d0e", fontSize: "14px", fontWeight: 700 }}>
              מצב תמיכה — צופה כ: {adminViewName || adminViewClient?.brand_name || ""}
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
      <nav className="sticky top-0 z-50 flex h-[60px] items-center justify-between bg-primary px-4 shadow-md">
        <div className="flex items-center gap-2">
          <img
            src={LOGO_URL}
            alt="INBOT"
            className="h-9 rounded"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            style={{ cursor: "pointer" }}
          />
          <span className="text-[11px] text-white/40">v3.0</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-white/80">{user?.email}</span>
          {!isAdminView && (
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-1.5 text-[12px] text-white transition-colors hover:bg-white/10"
            >
              <LogOut size={14} />
              התנתק
            </button>
          )}
        </div>
      </nav>

      {/* Tab Bar */}
      <div className="border-b border-border bg-card">
        <div className="flex gap-1 overflow-x-auto px-4">
          {TABS.filter((tab) => {
            if (tab.key === "messages" || tab.key === "archive") return !!hasAccountant;
            return true;
          }).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex items-center gap-1.5 whitespace-nowrap px-4 py-3 text-[13px] transition-colors ${
                  isActive
                    ? "border-b-2 border-primary font-bold text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={16} />
                {tab.label}
                {"badge" in tab && tab.badge && (unreadCount ?? 0) > 0 && (
                  <span className="absolute -top-0.5 -left-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <main className="py-4 md:py-6">
        <div className="mx-auto w-full md:w-[90%] bg-white rounded-none md:rounded-xl shadow-none md:shadow-[0_4px_12px_rgba(0,0,0,.08)] overflow-hidden">
          {activeTab === "dashboard" ? (
            <div className="space-y-6 p-4 md:p-6">
              {/* 1. Period Selector */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-medium text-muted-foreground">תקופה:</span>
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPeriod(p.key)}
                    className={`rounded-lg px-4 py-2 text-[13px] font-medium transition-colors ${
                      period === p.key
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* 2. KPI Cards — always visible */}
              <KPICards kpis={kpis} prevKpis={prevKpis} isLoading={kpisLoading} />

              {/* 3. Recent Invoices Table */}
              <RecentInvoicesTable
                invoices={recentInvoices}
                isLoading={recentLoading}
                onViewAll={() => setActiveTab("invoices")}
                hasAccountant={!!hasAccountant}
              />

              {/* 4. Charts — Pie right (40%), Bar left (60%) */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_3fr]">
                <CategoryPieChart data={categories} isLoading={categoriesLoading} />
                <ExpenseChart data={timeline} isLoading={timelineLoading} />
              </div>
            </div>
          ) : activeTab === "invoices" ? (
            <InvoicesTab clientId={effectiveClientId} hasAccountant={!!hasAccountant} isReadOnly={isAdminView} />
          ) : activeTab === "messages" ? (
            effectiveClientId ? <AccountantTab clientId={effectiveClientId} /> : null
          ) : activeTab === "archive" ? (
            effectiveClientId ? <ArchiveTab clientId={effectiveClientId} /> : null
          ) : activeTab === "export" ? (
            <ExportTab />
          ) : activeTab === "ai" ? (
            <AiChatTab />
          ) : activeTab === "settings" ? (
            <SettingsTab />
          ) : (
            <p className="py-16 text-center text-muted-foreground">בקרוב...</p>
          )}
        </div>
      </main>
    </div>
  );
}
