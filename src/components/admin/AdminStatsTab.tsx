import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  UserCheck,
  TrendingUp,
  AlertTriangle,
  FileText,
  Wallet,
  Clock,
  MessageSquare,
  Percent,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { useVatRules, useUpdateVatRule, type VatRule } from "@/hooks/useVatRules";

interface ExpiredItem {
  id: string;
  name: string;
  type: "client" | "accountant";
  plan_expires_at: string;
}

export default function AdminStatsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const startOfMonthISO = startOfMonth.toISOString().slice(0, 10);

      const [clientsRes, accountantsRes, acRes, invoicesRes] = await Promise.all([
        supabase.from("clients").select("id, brand_name, is_active, plan_expires_at"),
        supabase.from("accountants").select("id, name, is_active, plan_expires_at, price_per_client"),
        supabase.from("accountant_clients").select("accountant_id").is("unassigned_at", null),
        supabase.from("invoices").select("id, total, status, invoice_date"),
      ]);
      const invoices = invoicesRes.data || [];

      const clients = clientsRes.data || [];
      const accountants = accountantsRes.data || [];
      const acLinks = acRes.data || [];

      const activeClients = clients.filter((c) => c.is_active).length;
      const activeAccountants = accountants.filter((a) => a.is_active).length;

      // Revenue: price_per_client × client_count per accountant
      const acCountMap = new Map<string, number>();
      acLinks.forEach((ac) => acCountMap.set(ac.accountant_id, (acCountMap.get(ac.accountant_id) || 0) + 1));
      let estimatedRevenue = 0;
      accountants.forEach((a) => {
        if (a.is_active) {
          estimatedRevenue += (a.price_per_client || 0) * (acCountMap.get(a.id) || 0);
        }
      });

      const now = Date.now();
      const expired: ExpiredItem[] = [];
      clients.forEach((c) => {
        if (c.plan_expires_at && new Date(c.plan_expires_at).getTime() < now) {
          expired.push({ id: c.id, name: c.brand_name, type: "client", plan_expires_at: c.plan_expires_at });
        }
      });
      accountants.forEach((a) => {
        if (a.plan_expires_at && new Date(a.plan_expires_at).getTime() < now) {
          expired.push({ id: a.id, name: a.name, type: "accountant", plan_expires_at: a.plan_expires_at });
        }
      });

      const invoicesThisMonth = invoices.filter(
        (inv) => inv.invoice_date && inv.invoice_date >= startOfMonthISO
      ).length;

      const totalExpensesThisMonth = invoices
        .filter((inv) => inv.invoice_date && inv.invoice_date >= startOfMonthISO)
        .reduce((sum, inv) => sum + (inv.total || 0), 0);

      const pendingClarification = invoices.filter(
        (inv) => inv.status === "needs_clarification"
      ).length;

      const pendingReview = invoices.filter(
        (inv) => inv.status === "pending_review"
      ).length;

      const top5 = accountants
        .filter((a) => a.is_active)
        .map((a) => ({
          id: a.id,
          name: a.name,
          clientCount: acCountMap.get(a.id) || 0,
          monthlyRevenue: (a.price_per_client || 0) * (acCountMap.get(a.id) || 0),
        }))
        .sort((a, b) => b.clientCount - a.clientCount)
        .slice(0, 5);

      return {
        activeClients,
        activeAccountants,
        estimatedRevenue,
        expired,
        invoicesThisMonth,
        totalExpensesThisMonth,
        pendingClarification,
        pendingReview,
        top5,
        // derived
        totalActiveLinks: acLinks.length,
        activeClientsCount: activeClients,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
    );
  }

  const stats = data!;

  const kpis = [
    {
      label: "לקוחות פעילים",
      value: stats.activeClients,
      gradient: "linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)",
      Icon: Users,
    },
    {
      label: 'רו"חים פעילים',
      value: stats.activeAccountants,
      gradient: "linear-gradient(135deg, #1e3a5f 0%, #1a5276 100%)",
      Icon: UserCheck,
    },
    {
      label: "הכנסה חודשית משוערת",
      value: `₪${stats.estimatedRevenue.toLocaleString("he-IL")}`,
      gradient: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
      Icon: TrendingUp,
    },
    {
      label: "התראות פתוחות",
      value: stats.expired.length,
      gradient: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
      Icon: AlertTriangle,
    },
    {
      label: "חשבוניות החודש",
      value: stats.invoicesThisMonth,
      gradient: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
      Icon: FileText,
    },
    {
      label: 'סה"כ הוצאות החודש',
      value: `₪${stats.totalExpensesThisMonth.toLocaleString("he-IL")}`,
      gradient: "linear-gradient(135deg, #0891b2 0%, #0e7490 100%)",
      Icon: Wallet,
    },
    {
      label: "ממתינות לבדיקה",
      value: stats.pendingReview,
      gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
      Icon: Clock,
    },
    {
      label: "בקשות הבהרה פתוחות",
      value: stats.pendingClarification,
      gradient: "linear-gradient(135deg, #e8941a 0%, #c2770f 100%)",
      Icon: MessageSquare,
    },
  ];

  // Activity bar derived metrics
  const totalLinks = stats.totalActiveLinks;
  const avgClientsPerAccountant =
    stats.activeAccountants > 0 ? (totalLinks / stats.activeAccountants).toFixed(1) : "0";
  const managedRate =
    stats.activeClientsCount > 0
      ? Math.round((totalLinks / stats.activeClientsCount) * 100)
      : 0;

  const maxClientCount = Math.max(...stats.top5.map((a) => a.clientCount), 1);

  const rankStyles = (i: number) => {
    if (i === 0)
      return { background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", color: "#fff" };
    if (i === 1)
      return { background: "linear-gradient(135deg, #94a3b8 0%, #64748b 100%)", color: "#fff" };
    if (i === 2)
      return { background: "linear-gradient(135deg, #d97706 0%, #b45309 100%)", color: "#fff" };
    return { background: "#f1f5f9", color: "#64748b" };
  };

  return (
    <div className="space-y-6" style={{ fontFamily: "Heebo, sans-serif" }}>
      {/* SECTION 4 — Activity Summary Bar */}
      <div
        style={{
          background: "#f0f4f8",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "14px 20px",
          textAlign: "center",
          color: "#64748b",
          fontSize: "14px",
          fontWeight: 500,
        }}
      >
        סה״כ שיוכים פעילים:{" "}
        <span style={{ color: "#1a202c", fontWeight: 700 }}>{totalLinks}</span>
        <span style={{ margin: "0 12px", color: "#cbd5e1" }}>|</span>
        ממוצע לקוחות לרו״ח:{" "}
        <span style={{ color: "#1a202c", fontWeight: 700 }}>{avgClientsPerAccountant}</span>
        <span style={{ margin: "0 12px", color: "#cbd5e1" }}>|</span>
        שיעור לקוחות מנוהלים:{" "}
        <span style={{ color: "#1a202c", fontWeight: 700 }}>{managedRate}%</span>
      </div>

      {/* SECTION 1 — KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k, i) => {
          const Icon = k.Icon;
          return (
            <div
              key={i}
              style={{
                position: "relative",
                overflow: "hidden",
                background: k.gradient,
                borderRadius: "16px",
                padding: "20px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                color: "#fff",
                minHeight: "120px",
              }}
            >
              <p
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  opacity: 0.85,
                  margin: 0,
                }}
              >
                {k.label}
              </p>
              <p
                style={{
                  fontSize: "32px",
                  fontWeight: 900,
                  margin: "8px 0 0 0",
                  lineHeight: 1.1,
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {k.value}
              </p>
              <Icon
                size={64}
                style={{
                  position: "absolute",
                  bottom: "-8px",
                  left: "-8px",
                  opacity: 0.15,
                  pointerEvents: "none",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* SECTION 2 — Top 5 leaderboard */}
      {stats.top5.length > 0 && (
        <div>
          <h3
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color: "#1e3a5f",
              marginBottom: "12px",
            }}
          >
            🏆 Top 5 רואי חשבון
          </h3>
          <div className="space-y-2">
            {stats.top5.map((a, i) => {
              const pct = (a.clientCount / maxClientCount) * 100;
              return (
                <div
                  key={a.id}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "14px 16px",
                    transition: "background 0.15s",
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                >
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "9999px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "13px",
                      fontWeight: 800,
                      flexShrink: 0,
                      ...rankStyles(i),
                    }}
                  >
                    {i + 1}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                        marginBottom: "6px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "14px",
                          fontWeight: 700,
                          color: "#1e3a5f",
                        }}
                      >
                        {a.name}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span
                          style={{
                            background: "#1e3a5f",
                            color: "#fff",
                            fontSize: "11px",
                            fontWeight: 600,
                            padding: "3px 10px",
                            borderRadius: "9999px",
                          }}
                        >
                          {a.clientCount} לקוחות
                        </span>
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            color: a.monthlyRevenue > 0 ? "#16a34a" : "#64748b",
                            minWidth: "80px",
                            textAlign: "left",
                          }}
                        >
                          {a.monthlyRevenue > 0
                            ? `₪${a.monthlyRevenue.toLocaleString("he-IL")}`
                            : "—"}
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        height: "4px",
                        background: "#f1f5f9",
                        borderRadius: "9999px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          background: "#e8941a",
                          borderRadius: "9999px",
                          transition: "width 0.3s",
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 3 — Expiry alerts */}
      {stats.expired.length > 0 && (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRight: "4px solid #dc2626",
            borderRadius: "12px",
            padding: "16px 20px",
          }}
        >
          <h3
            style={{
              fontSize: "15px",
              fontWeight: 700,
              color: "#dc2626",
              margin: "0 0 12px 0",
            }}
          >
            ⚠️ התראות מנוי פג
          </h3>
          <div className="space-y-2">
            {stats.expired.slice(0, 5).map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#fef2f2",
                  borderRadius: "8px",
                  padding: "8px 12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontWeight: 700, color: "#1a202c", fontSize: "14px" }}>
                    {item.name}
                  </span>
                  <span
                    style={{
                      background: "#1e3a5f",
                      color: "#fff",
                      fontSize: "10px",
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: "9999px",
                    }}
                  >
                    {item.type === "client" ? "לקוח" : 'רו"ח'}
                  </span>
                </div>
                <span style={{ fontSize: "12px", color: "#dc2626", opacity: 0.8 }}>
                  פג: {new Date(item.plan_expires_at).toLocaleDateString("he-IL")}
                </span>
              </div>
            ))}
            {stats.expired.length > 5 && (
              <div
                style={{
                  textAlign: "center",
                  fontSize: "12px",
                  color: "#64748b",
                  paddingTop: "4px",
                }}
              >
                ועוד {stats.expired.length - 5} נוספים
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
