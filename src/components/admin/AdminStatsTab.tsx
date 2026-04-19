import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

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
      };
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
    );
  }

  const stats = data!;
  const kpis = [
    { label: "לקוחות פעילים", value: stats.activeClients, color: "blue" },
    { label: "רו\"חים פעילים", value: stats.activeAccountants, color: "blue" },
    { label: "הכנסה חודשית משוערת", value: `₪${stats.estimatedRevenue.toLocaleString("he-IL")}`, color: "green" },
    { label: "התראות פתוחות", value: stats.expired.length, color: "red" },
    { label: "חשבוניות החודש", value: stats.invoicesThisMonth, color: "blue" },
    { label: "סה\"כ הוצאות החודש", value: `₪${stats.totalExpensesThisMonth.toLocaleString("he-IL")}`, color: "green" },
    { label: "ממתינות לבדיקה", value: stats.pendingReview, color: "orange" },
    { label: "בקשות הבהרה פתוחות", value: stats.pendingClarification, color: "orange" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-card p-5 shadow-card"
            style={{
              borderRight: `4px solid ${
                k.color === "green" ? "#16a34a"
                : k.color === "red" ? "#dc2626"
                : k.color === "orange" ? "#e8941a"
                : "#1e3a5f"
              }`,
            }}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
            <p className="mt-2 text-2xl font-black text-foreground">{k.value}</p>
          </div>
        ))}
      </div>

      {stats.expired.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5 shadow-card">
          <h3 className="mb-3 text-base font-bold">התראות מנוי פג</h3>
          <div className="space-y-2">
            {stats.expired.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-md bg-accent/10 px-4 py-2">
                <div>
                  <span className="font-medium">{item.name}</span>
                  <span className="mr-2 text-xs text-muted-foreground">
                    ({item.type === "client" ? "לקוח" : "רו\"ח"}) — פג: {new Date(item.plan_expires_at).toLocaleDateString("he-IL")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.top5.length > 0 && (
        <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
          <div
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "14px",
              fontWeight: 700,
              color: "#1e3a5f",
            }}
          >
            🏆 Top 5 רואי חשבון
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary text-right text-xs font-semibold text-muted-foreground border-b border-border">
                <th className="p-3">דירוג</th>
                <th className="p-3">שם</th>
                <th className="p-3">לקוחות פעילים</th>
                <th className="p-3">הכנסה חודשית</th>
              </tr>
            </thead>
            <tbody>
              {stats.top5.map((a, i) => (
                <tr key={a.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                  <td className="p-3">
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "24px",
                      height: "24px",
                      borderRadius: "9999px",
                      fontSize: "12px",
                      fontWeight: 700,
                      background: i === 0 ? "#fef3e2" : i === 1 ? "#f0f4f8" : "#f8fafc",
                      color: i === 0 ? "#e8941a" : "#64748b",
                    }}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="p-3 font-medium">{a.name}</td>
                  <td className="p-3">{a.clientCount}</td>
                  <td className="p-3">
                    {a.monthlyRevenue > 0
                      ? `₪${a.monthlyRevenue.toLocaleString("he-IL")}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
