import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AdminClientsTab from "@/components/admin/AdminClientsTab";
import AdminAccountantsTab from "@/components/admin/AdminAccountantsTab";
import AdminStatsTab from "@/components/admin/AdminStatsTab";
import { AdminBillingTab } from "@/components/admin/AdminBillingTab";
import { AdminPlansTab } from "@/components/admin/AdminPlansTab";
import { BarChart2, Users, Building2, CreditCard, Package } from "lucide-react";

const tabs = [
  { key: "stats", label: "סטטיסטיקות", icon: BarChart2 },
  { key: "accountants", label: "רואי חשבון", icon: Users },
  { key: "clients", label: "לקוחות", icon: Building2 },
  { key: "billing", label: "חיוב", icon: CreditCard },
  { key: "plans", label: "חבילות", icon: Package },
] as const;

type TabKey = (typeof tabs)[number]["key"];

const AdminDashboard = () => {
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const saved = localStorage.getItem("admin-active-tab");
    const valid: TabKey[] = ["stats", "accountants", "clients", "billing", "plans"];
    return valid.includes(saved as TabKey) ? (saved as TabKey) : "stats";
  });
  const [billingFilterId, setBillingFilterId] = useState<string | undefined>(undefined);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const goToBilling = (accountantId: string) => {
    setBillingFilterId(accountantId);
    setActiveTab("billing");
    localStorage.setItem("admin-active-tab", "billing");
  };

  return (
    <div dir="rtl" lang="he" className="min-h-screen bg-background font-sans">
      {/* Navbar */}
      <nav className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card px-6 py-3 shadow-sm">
        <img
          src="https://jkqpkbcdtbelgpuwncam.supabase.co/storage/v1/object/public/assets//LOGO.jpeg"
          alt="INBOT"
          onClick={() => {
            setActiveTab("stats");
            localStorage.setItem("admin-active-tab", "stats");
          }}
          style={{ height: '36px', borderRadius: '6px', cursor: 'pointer' }}
        />

        {!isMobile && (
          <div className="flex gap-1 rounded-lg bg-secondary p-1">
            {tabs.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => {
                    setActiveTab(t.key);
                    localStorage.setItem("admin-active-tab", t.key);
                    if (t.key !== "billing") setBillingFilterId(undefined);
                  }}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === t.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon size={14} style={{ display: 'inline', marginLeft: '5px', verticalAlign: 'middle' }} />
                  {t.label}
                </button>
              );
            })}
          </div>
        )}

        <button
          onClick={signOut}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          התנתק
        </button>
      </nav>

      {/* Content */}
      <main className="mx-auto max-w-7xl p-6" style={{ paddingBottom: isMobile ? "80px" : undefined }}>
        {activeTab === "clients" && <AdminClientsTab />}
        {activeTab === "accountants" && <AdminAccountantsTab onGoToBilling={goToBilling} />}
        {activeTab === "stats" && <AdminStatsTab />}
        {activeTab === "billing" && (
          <AdminBillingTab
            initialAccountantId={billingFilterId}
            onClearFilter={() => setBillingFilterId(undefined)}
          />
        )}
        {activeTab === "plans" && <AdminPlansTab />}
      </main>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          height: "64px", backgroundColor: "#1e3a5f",
          display: "flex", justifyContent: "space-around", alignItems: "center",
          zIndex: 1000, borderTop: "2px solid #e8941a"
        }}>
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => {
                  setActiveTab(t.key);
                  localStorage.setItem("admin-active-tab", t.key);
                  if (t.key !== "billing") setBillingFilterId(undefined);
                }}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  gap: "2px", background: "none", border: "none", cursor: "pointer",
                  color: activeTab === t.key ? "#e8941a" : "#94a3b8",
                  fontSize: "10px", padding: "8px", fontFamily: "Heebo, sans-serif"
                }}
              >
                <Icon size={20} />
                {t.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
