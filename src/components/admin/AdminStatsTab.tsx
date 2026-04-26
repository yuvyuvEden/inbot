import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  UserCheck,
  TrendingUp,
  FileText,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

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
        supabase.from("clients").select("id, brand_name, is_active, plan_expires_at, plan_type"),
        supabase.from("accountants").select("id, name, is_active, plan_expires_at, price_per_client"),
        supabase.from("accountant_clients").select("accountant_id, client_id").is("unassigned_at", null),
        supabase.from("invoices").select("id, total, status, invoice_date, client_id"),
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

      // חשבוניות שנאספו החודש
      const invoicesThisMonth = invoices.filter(
        (inv) => inv.invoice_date && inv.invoice_date >= startOfMonthISO
      ).length;

      // נתוני גרף — חשבוניות לפי חודש (6 חודשים אחרונים)
      const nowDate = new Date();
      const monthlyData = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - (5 - i), 1);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const label = d.toLocaleDateString("he-IL", { month: "short", year: "2-digit" });
        const count = invoices.filter((inv) => {
          if (!inv.invoice_date) return false;
          const [iy, im] = inv.invoice_date.split("-").map(Number);
          return iy === y && im === m;
        }).length;
        return { label, count };
      });

      // פילוח לקוחות — משויכים מול לא משויכים
      const assignedClientIds = new Set(acLinks.map((ac: any) => ac.client_id));
      const activeClientsList = clients.filter((c: any) => c.is_active);
      const assignedCount = activeClientsList.filter((c: any) => assignedClientIds.has(c.id)).length;
      const unassignedCount = activeClientsList.length - assignedCount;
      const assignmentData = [
        { name: "משויכים לרו״ח", value: assignedCount },
        { name: "לא משויכים", value: unassignedCount },
      ];

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
        monthlyData,
        assignmentData,
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
      label: "מנויים פגו השבוע",
      value: stats.expiredThisWeek,
      gradient: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
      Icon: AlertTriangle,
    },
    {
      label: "חשבוניות שנאספו החודש",
      value: stats.invoicesThisMonth,
      gradient: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
      Icon: FileText,
    },
    {
      label: "שיוכים פעילים",
      value: stats.totalActiveLinks,
      gradient: "linear-gradient(135deg, #0891b2 0%, #0e7490 100%)",
      Icon: Link,
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

      {/* CHARTS SECTION */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }} className="max-md:grid-cols-1">
        {/* גרף עמודות — חשבוניות לפי חודש */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#1e3a5f", margin: "0 0 16px 0" }}>
            📊 חשבוניות שנאספו — 6 חודשים אחרונים
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stats.monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fontFamily: "Heebo" }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip formatter={(v: any) => [v, "חשבוניות"]} />
              <Bar dataKey="count" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* גרף עוגה — פילוח לפי תוכנית */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#1e3a5f", margin: "0 0 16px 0" }}>
            🥧 פילוח לקוחות לפי תוכנית
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={stats.planData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={65}
                label={({ name, value }) => `${name} (${value})`}
                labelLine={false}
              >
                {stats.planData.map((_: any, index: number) => (
                  <Cell key={index} fill={["#1e3a5f", "#e8941a", "#16a34a", "#7c3aed", "#0891b2"][index % 5]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

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

      {/* SECTION 5 — Global VAT rules */}
      <VatRulesSection />
    </div>
  );
}

/* ── VAT Rules editor (admin only) ── */
function VatRulesSection() {
  const { data: rules = [], isLoading } = useVatRules();
  const updateRule = useUpdateVatRule();
  const [drafts, setDrafts] = useState<Record<string, { vat_rate: number; tax_rate: number; no_vat: boolean }>>({});

  useEffect(() => {
    const next: Record<string, { vat_rate: number; tax_rate: number; no_vat: boolean }> = {};
    rules.forEach((r) => {
      next[r.category] = { vat_rate: r.vat_rate, tax_rate: r.tax_rate, no_vat: r.no_vat };
    });
    setDrafts(next);
  }, [rules]);

  const isDirty = (r: VatRule) => {
    const d = drafts[r.category];
    if (!d) return false;
    return d.vat_rate !== r.vat_rate || d.tax_rate !== r.tax_rate || d.no_vat !== r.no_vat;
  };

  const handleSave = async (category: string) => {
    const d = drafts[category];
    if (!d) return;
    try {
      await updateRule.mutateAsync({ category, ...d });
      toast.success(`כלל "${category}" נשמר`);
    } catch (e: any) {
      toast.error(e.message || "שגיאה בשמירת הכלל");
    }
  };

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        padding: "16px 20px",
        fontFamily: "Heebo, sans-serif",
      }}
      dir="rtl"
    >
      <h3
        style={{
          fontSize: "16px",
          fontWeight: 700,
          color: "#1e3a5f",
          margin: "0 0 4px 0",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Percent size={16} /> כללי מע״מ גלובליים
      </h3>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
        עריכת אחוז מע״מ מוכר, אחוז הכרה במס, וסימון פטור ממע״מ לכל קטגוריה. ערכים בין 0 ל-1.
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["קטגוריה", "מע״מ מוכר", "הוצאה מוכרת", "פטור ממע״מ", "פעולות"].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      padding: 8,
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: ".4px",
                      color: "#64748b",
                      fontWeight: 600,
                      textAlign: i === 0 ? "right" : "center",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 16, textAlign: "center", color: "#64748b" }}>
                    אין כללים
                  </td>
                </tr>
              )}
              {rules.map((r) => {
                const d = drafts[r.category] ?? { vat_rate: r.vat_rate, tax_rate: r.tax_rate, no_vat: r.no_vat };
                const dirty = isDirty(r);
                return (
                  <tr key={r.category} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: 8, fontWeight: 600, color: "#1e3a5f" }}>{r.category}</td>
                    <td style={{ padding: 8, textAlign: "center" }}>
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.0001}
                        value={d.vat_rate}
                        disabled={d.no_vat}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [r.category]: { ...d, vat_rate: parseFloat(e.target.value) || 0 },
                          }))
                        }
                        onBlur={() => dirty && handleSave(r.category)}
                        style={{
                          width: 80,
                          padding: "5px 8px",
                          border: "1px solid #e2e8f0",
                          borderRadius: 6,
                          fontSize: 13,
                          textAlign: "center",
                          fontFamily: "monospace",
                          direction: "ltr",
                          background: d.no_vat ? "#f1f5f9" : "#fff",
                        }}
                      />
                    </td>
                    <td style={{ padding: 8, textAlign: "center" }}>
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.0001}
                        value={d.tax_rate}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [r.category]: { ...d, tax_rate: parseFloat(e.target.value) || 0 },
                          }))
                        }
                        onBlur={() => dirty && handleSave(r.category)}
                        style={{
                          width: 80,
                          padding: "5px 8px",
                          border: "1px solid #e2e8f0",
                          borderRadius: 6,
                          fontSize: 13,
                          textAlign: "center",
                          fontFamily: "monospace",
                          direction: "ltr",
                        }}
                      />
                    </td>
                    <td style={{ padding: 8, textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={d.no_vat}
                        onChange={(e) => {
                          const next = { ...d, no_vat: e.target.checked };
                          if (e.target.checked) next.vat_rate = 0;
                          setDrafts((prev) => ({ ...prev, [r.category]: next }));
                        }}
                        style={{ width: 16, height: 16, cursor: "pointer" }}
                      />
                    </td>
                    <td style={{ padding: 8, textAlign: "center" }}>
                      <button
                        onClick={() => handleSave(r.category)}
                        disabled={!dirty || updateRule.isPending}
                        style={{
                          background: dirty ? "#1e3a5f" : "#f1f5f9",
                          color: dirty ? "#fff" : "#94a3b8",
                          border: "none",
                          borderRadius: 6,
                          padding: "5px 10px",
                          cursor: dirty ? "pointer" : "not-allowed",
                          fontSize: 12,
                          fontFamily: "Heebo, sans-serif",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Save size={12} /> שמור
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
