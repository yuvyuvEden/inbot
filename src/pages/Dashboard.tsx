import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import {
  BarChart2, FileText, MessageSquare, Archive, Download, Bot, Settings, LogOut,
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
  const { user, signOut } = useAuth();
  const { data: client } = useClientRecord();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [period, setPeriod] = useState("this_month");
  const { data: kpis, isLoading: kpisLoading } = useInvoiceKPIs(client?.id, period);
  const { data: prevKpis } = useInvoiceKPIsDelta(client?.id, period);
  const { data: unreadCount } = useUnreadComments(client?.id);
  const { data: timeline, isLoading: timelineLoading } = useExpenseTimeline(client?.id, period);
  const { data: categories, isLoading: categoriesLoading } = useCategoryBreakdown(client?.id, period);
  const { data: recentInvoices, isLoading: recentLoading } = useRecentInvoices(client?.id);

  const { data: hasAccountant } = useQuery({
    queryKey: ["has-accountant", client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from("accountant_clients")
        .select("id", { count: "exact", head: true })
        .eq("client_id", client!.id);
      return (count ?? 0) > 0;
    },
  });

  return (
    <div dir="rtl" className="min-h-screen bg-background font-sans">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 flex h-[60px] items-center justify-between bg-primary px-4 shadow-md">
        <div className="flex items-center gap-2">
          <img src={LOGO_URL} alt="INBOT" className="h-9 rounded" />
          <span className="text-[11px] text-white/40">v3.0</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-white/80">{user?.email}</span>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-1.5 text-[12px] text-white transition-colors hover:bg-white/10"
          >
            <LogOut size={14} />
            התנתק
          </button>
        </div>
      </nav>

      {/* Tab Bar */}
      <div className="border-b border-border bg-card">
        <div className="flex gap-1 overflow-x-auto px-4">
          {TABS.map((tab) => {
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
              />

              {/* 4. Charts — Pie right (40%), Bar left (60%) */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_3fr]">
                <CategoryPieChart data={categories} isLoading={categoriesLoading} />
                <ExpenseChart data={timeline} isLoading={timelineLoading} />
              </div>
            </div>
          ) : activeTab === "invoices" ? (
            <InvoicesTab clientId={client?.id} />
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
