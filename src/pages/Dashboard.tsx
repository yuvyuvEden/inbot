import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useClientRecord, useInvoiceKPIs, useUnreadComments } from "@/hooks/useClientData";
import { Skeleton } from "@/components/ui/skeleton";
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

function formatCurrency(n: number) {
  return "₪" + n.toLocaleString("he-IL", { maximumFractionDigits: 0 });
}

const KPI_CARDS = [
  { key: "totalExpenses", label: "סה״כ הוצאות", color: "#1e3a5f", format: true },
  { key: "totalVat", label: "מע״מ לקיזוז", color: "#16a34a", format: true },
  { key: "totalTax", label: "הוצאה מוכרת מס", color: "#7c3aed", format: true },
  { key: "count", label: "חשבוניות", color: "#e8941a", format: false },
  { key: "noAllocation", label: "ללא הקצאה", color: "#dc2626", format: false },
] as const;

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { data: client } = useClientRecord();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [period, setPeriod] = useState("this_month");
  const { data: kpis, isLoading } = useInvoiceKPIs(client?.id, period);
  const { data: unreadCount } = useUnreadComments(client?.id);

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
      <main className="mx-auto max-w-6xl p-4 md:p-6">
        {activeTab === "dashboard" ? (
          <>
            {/* Period Selector */}
            <div className="mb-6 flex flex-wrap gap-2">
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

            {/* KPI Cards */}
            {isLoading ? (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
                {KPI_CARDS.map((c) => (
                  <Skeleton key={c.key} className="h-[110px] rounded-xl" />
                ))}
              </div>
            ) : kpis && (kpis.count > 0 || kpis.totalExpenses > 0) ? (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
                {KPI_CARDS.map((card) => {
                  const value = kpis[card.key as keyof typeof kpis];
                  return (
                    <div
                      key={card.key}
                      className="rounded-xl bg-card p-5 shadow-card"
                      style={{ borderRight: `4px solid ${card.color}` }}
                    >
                      <p className="mb-2 text-[13px] text-muted-foreground">{card.label}</p>
                      <p className="text-2xl font-bold text-foreground">
                        {card.format ? formatCurrency(value as number) : value}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-16 text-center text-muted-foreground">אין נתונים לתקופה זו</p>
            )}
          </>
        ) : (
          <p className="py-16 text-center text-muted-foreground">בקרוב...</p>
        )}
      </main>
    </div>
  );
}
