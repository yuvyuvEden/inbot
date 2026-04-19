import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AdminClientsTab from "@/components/admin/AdminClientsTab";
import AdminAccountantsTab from "@/components/admin/AdminAccountantsTab";
import AdminStatsTab from "@/components/admin/AdminStatsTab";

const tabs = [
  { key: "stats", label: "סטטיסטיקות" },
  { key: "accountants", label: "רואי חשבון" },
  { key: "clients", label: "לקוחות" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

const AdminDashboard = () => {
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const saved = localStorage.getItem("admin-active-tab");
    const valid: TabKey[] = ["stats", "accountants", "clients"];
    return valid.includes(saved as TabKey) ? (saved as TabKey) : "stats";
  });

  return (
    <div dir="rtl" lang="he" className="min-h-screen bg-background font-sans">
      {/* Navbar */}
      <nav className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card px-6 py-3 shadow-sm">
        <img
          src="https://jkqpkbcdtbelgpuwncam.supabase.co/storage/v1/object/public/assets//LOGO.jpeg"
          alt="INBOT"
          style={{ height: '36px', borderRadius: '6px' }}
        />

        <div className="flex gap-1 rounded-lg bg-secondary p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setActiveTab(t.key);
                localStorage.setItem("admin-active-tab", t.key);
              }}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          onClick={signOut}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          התנתק
        </button>
      </nav>

      {/* Content */}
      <main className="mx-auto max-w-7xl p-6">
        {activeTab === "clients" && <AdminClientsTab />}
        {activeTab === "accountants" && <AdminAccountantsTab />}
        {activeTab === "stats" && <AdminStatsTab />}
      </main>
    </div>
  );
};

export default AdminDashboard;
