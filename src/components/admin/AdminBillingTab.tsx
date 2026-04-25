import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  useBillingLogWithNames,
  useBillingStats,
  useCreateBillingEntry,
  useUpdateBillingStatus,
  useDeleteBillingEntry,
  useWaiveBillingEntry,
  calcAccountantBill,
} from "@/hooks/useBilling";
import {
  CheckCircle,
  Clock,
  XCircle,
  Gift,
  Plus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Search,
  Zap,
  Trash2,
  X,
} from "lucide-react";

const fmt = (n: number) =>
  "₪" +
  Number(n).toLocaleString("he-IL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const MONTHS_HE = [
  "", "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

const fmtPeriod = (p: string) => {
  if (!p) return "—";
  const [y, m] = p.split("-");
  return `${MONTHS_HE[parseInt(m)]} ${y}`;
};

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("he-IL") : "—";

const shiftPeriod = (p: string, delta: number) => {
  const [y, m] = p.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const last12Months = () => {
  const arr: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return arr;
};

type StatusKey = "pending" | "paid" | "failed" | "waived";

const STATUS_MAP: Record<StatusKey, { label: string; bg: string; color: string; icon: typeof Clock }> = {
  pending: { label: "ממתין", bg: "#fff7ed", color: "#ea580c", icon: Clock },
  paid: { label: "שולם", bg: "#f0fdf4", color: "#16a34a", icon: CheckCircle },
  failed: { label: "נכשל", bg: "#fef2f2", color: "#dc2626", icon: XCircle },
  waived: { label: "פטור", bg: "#f8fafc", color: "#64748b", icon: Gift },
};

const TYPE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  accountant: { label: 'רו"ח', bg: "#1e3a5f", color: "#ffffff" },
  client_direct: { label: "לקוח ישיר", bg: "#e8941a", color: "#ffffff" },
  client_managed: { label: "לקוח מנוהל", bg: "#94a3b8", color: "#ffffff" },
};

const inputStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: "6px",
  border: "1px solid #e2e8f0",
  fontSize: "13px",
  fontFamily: "Heebo, sans-serif",
};

interface Props {
  initialAccountantId?: string;
  onClearFilter?: () => void;
}

export function AdminBillingTab({ initialAccountantId, onClearFilter }: Props) {
  const currentMonthStr = new Date().toISOString().slice(0, 7);

  const [billingSubTab, setBillingSubTab] = useState<"all" | "accountants" | "direct" | "managed">("all");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("");
  const [filterType, setFilterType] = useState("");
  const [searchName, setSearchName] = useState("");
  const [accSearch, setAccSearch] = useState("");
  const [statsPeriod, setStatsPeriod] = useState(currentMonthStr);

  const [showMarkPaidModal, setShowMarkPaidModal] = useState<any | null>(null);
  const [markPaidMethod, setMarkPaidMethod] = useState("external");
  const [markPaidNotes, setMarkPaidNotes] = useState("");
  const [markPaidExtId, setMarkPaidExtId] = useState("");

  const [showWaiveModal, setShowWaiveModal] = useState<any | null>(null);
  const [waiveReason, setWaiveReason] = useState("");

  const [generateAllLoading, setGenerateAllLoading] = useState(false);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    if (initialAccountantId) setBillingSubTab("accountants");
  }, [initialAccountantId]);

  const { data: stats } = useBillingStats();
  const { data: allLogs = [], isLoading: logsLoading } = useBillingLogWithNames();
  const updateStatus = useUpdateBillingStatus();
  const createEntry = useCreateBillingEntry();
  const deleteEntry = useDeleteBillingEntry();
  const waiveEntry = useWaiveBillingEntry();

  // רואי חשבון
  const { data: accountants = [] } = useQuery({
    queryKey: ["accountants-billing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accountants")
        .select(
          "id, name, email, base_client_count, monthly_fee, price_per_client, billing_day, free_months, is_active"
        )
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // לקוחות ישירים
  const { data: directClients = [] } = useQuery({
    queryKey: ["direct-clients-billing"],
    queryFn: async () => {
      const { data: allClients, error } = await supabase
        .from("clients")
        .select(
          "id, brand_name, legal_name, plan_type, billing_cycle, billing_day, free_months, plan_expires_at, is_active, locked_monthly_price, locked_yearly_price, monthly_price, yearly_price, plan_id, plans(name, monthly_price, yearly_price)"
        )
        .eq("is_active", true)
        .order("brand_name");
      if (error) throw error;
      const { data: acData } = await supabase
        .from("accountant_clients")
        .select("client_id")
        .is("unassigned_at", null);
      const managedIds = new Set((acData ?? []).map((ac: any) => ac.client_id));
      return (allClients ?? []).filter((c: any) => !managedIds.has(c.id));
    },
  });

  // לקוחות מנוהלים
  const { data: managedClients = [] } = useQuery({
    queryKey: ["managed-clients-billing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accountant_clients")
        .select("client_id, accountant_id, assigned_at, accountants(id, name)")
        .is("unassigned_at", null);
      if (error) throw error;
      const clientIds = (data ?? []).map((ac: any) => ac.client_id);
      if (!clientIds.length) return [];
      const { data: clients } = await supabase
        .from("clients")
        .select("id, brand_name, legal_name, plan_type, is_active")
        .in("id", clientIds);
      const clientMap = new Map((clients ?? []).map((c: any) => [c.id, c]));
      return (data ?? []).map((ac: any) => ({
        ...clientMap.get(ac.client_id),
        accountant_name: ac.accountants?.name ?? "—",
        accountant_id: ac.accountant_id,
        assigned_at: ac.assigned_at,
      }));
    },
  });

  // אילו רו"חים כבר חוייבו לתקופה הנוכחית
  const billedAccountantIds = useMemo(() => {
    return new Set(
      allLogs
        .filter((l: any) => l.entity_type === "accountant" && l.billing_period === currentMonthStr)
        .map((l: any) => l.entity_id)
    );
  }, [allLogs, currentMonthStr]);

  const billedDirectIds = useMemo(() => {
    return new Set(
      allLogs
        .filter((l: any) => l.entity_type === "client_direct" && l.billing_period === currentMonthStr)
        .map((l: any) => l.entity_id)
    );
  }, [allLogs, currentMonthStr]);

  // סינון לוגים
  const filteredLogs = useMemo(() => {
    return allLogs.filter((l: any) => {
      if (billingSubTab === "accountants" && l.entity_type !== "accountant") return false;
      if (billingSubTab === "direct" && l.entity_type !== "client_direct") return false;
      if (billingSubTab === "managed" && l.entity_type !== "client_managed") return false;
      if (filterStatus && l.status !== filterStatus) return false;
      if (filterPeriod && l.billing_period !== filterPeriod) return false;
      if (filterType && l.entity_type !== filterType) return false;
      if (
        searchName &&
        !(l.entity_name ?? "").toString().toLowerCase().includes(searchName.toLowerCase())
      )
        return false;
      if (
        initialAccountantId &&
        billingSubTab === "accountants" &&
        l.entity_id !== initialAccountantId
      )
        return false;
      return true;
    });
  }, [allLogs, billingSubTab, filterStatus, filterPeriod, filterType, searchName, initialAccountantId]);

  // KPIs לפי תקופה נבחרת
  const periodLogs = useMemo(
    () => allLogs.filter((l: any) => l.billing_period === statsPeriod),
    [allLogs, statsPeriod]
  );
  const periodStats = useMemo(() => ({
    expectedRevenue: periodLogs.filter((l: any) => l.status !== "waived").reduce((s: number, l: any) => s + Number(l.total_before_vat ?? 0), 0),
    collectedRevenue: periodLogs.filter((l: any) => l.status === "paid").reduce((s: number, l: any) => s + Number(l.total_before_vat ?? 0), 0),
    pendingCount: periodLogs.filter((l: any) => l.status === "pending").length,
    failedCount: periodLogs.filter((l: any) => l.status === "failed").length,
    waivedCount: periodLogs.filter((l: any) => l.status === "waived").length,
  }), [periodLogs]);

  const kpis = [
    { label: "הכנסה צפויה", value: fmt(periodStats.expectedRevenue), color: "#1e3a5f", icon: RefreshCw },
    { label: "גבייה בפועל", value: fmt(periodStats.collectedRevenue), color: "#16a34a", icon: CheckCircle },
    { label: "ממתינים", value: periodStats.pendingCount, color: "#ea580c", icon: Clock },
    { label: "כשלו", value: periodStats.failedCount, color: "#dc2626", icon: XCircle },
    { label: "פטורים", value: periodStats.waivedCount, color: "#64748b", icon: Gift },
  ];

  const filteredAccountants = useMemo(() => {
    let list = accountants;
    if (initialAccountantId) list = list.filter((a: any) => a.id === initialAccountantId);
    if (accSearch) list = list.filter((a: any) => a.name?.toLowerCase().includes(accSearch.toLowerCase()));
    return list;
  }, [accountants, accSearch, initialAccountantId]);

  // יצירת חיוב לרו"ח
  const generateAccountantBill = async (acc: any, activeCount: number) => {
    const isFree = (acc.free_months ?? 0) > 0;
    const calc = calcAccountantBill(
      activeCount,
      acc.base_client_count ?? 10,
      acc.monthly_fee ?? 0,
      acc.price_per_client ?? 0
    );
    await createEntry.mutateAsync({
      entity_type: "accountant",
      entity_id: acc.id,
      billing_period: currentMonthStr,
      billing_day: acc.billing_day ?? 1,
      base_count: acc.base_client_count ?? 10,
      extra_count: calc.extraCount,
      base_amount: isFree ? 0 : calc.baseAmount,
      extra_amount: isFree ? 0 : calc.extraAmount,
      total_before_vat: isFree ? 0 : calc.totalBeforeVat,
      vat_amount: isFree ? 0 : calc.vatAmount,
      total_with_vat: isFree ? 0 : calc.totalWithVat,
      status: isFree ? "waived" : "pending",
      payment_method: isFree ? "free" : undefined,
      notes: isFree ? `חודש חינם (נותרו ${acc.free_months - 1})` : undefined,
    });
    if (isFree) {
      await supabase.from("accountants").update({ free_months: acc.free_months - 1 }).eq("id", acc.id);
    }
  };

  // יצירת חיוב ללקוח ישיר
  const generateClientBill = async (client: any) => {
    const isFree = (client.free_months ?? 0) > 0;
    const planMonthly = client.plans?.monthly_price ?? client.monthly_price ?? 0;
    const planYearly = client.plans?.yearly_price ?? client.yearly_price ?? 0;
    const amount = client.billing_cycle === "yearly"
      ? (client.locked_yearly_price ?? planYearly)
      : (client.locked_monthly_price ?? planMonthly);
    const vatAmount = Math.round(amount * 0.18 * 100) / 100;
    const totalWithVat = Math.round((amount + vatAmount) * 100) / 100;
    await createEntry.mutateAsync({
      entity_type: "client_direct",
      entity_id: client.id,
      billing_period: currentMonthStr,
      billing_day: client.billing_day ?? 1,
      base_count: 1,
      extra_count: 0,
      base_amount: isFree ? 0 : amount,
      extra_amount: 0,
      total_before_vat: isFree ? 0 : amount,
      vat_amount: isFree ? 0 : vatAmount,
      total_with_vat: isFree ? 0 : totalWithVat,
      status: isFree ? "waived" : "pending",
      payment_method: isFree ? "free" : undefined,
      notes: isFree ? `חודש חינם (נותרו ${client.free_months - 1})` : undefined,
    });
    if (isFree) {
      await supabase.from("clients").update({ free_months: client.free_months - 1 }).eq("id", client.id);
    }
  };

  const generateAllBills = async () => {
    setGenerateAllLoading(true);
    let success = 0, skipped = 0, failed = 0;
    for (const acc of accountants) {
      try {
        await generateAccountantBill(acc, acc.base_client_count ?? 10);
        success++;
      } catch (e: any) {
        if (e.message?.includes("קיים כבר")) skipped++;
        else failed++;
      }
    }
    setGenerateAllLoading(false);
    toast.success(`הושלם: ${success} נוצרו, ${skipped} קיימים, ${failed} נכשלו`);
  };

  const accountantNameById = useMemo(() => {
    const m = new Map<string, string>();
    accountants.forEach((a: any) => m.set(a.id, a.name));
    return m;
  }, [accountants]);

  const showAccountantsTable = billingSubTab === "all" || billingSubTab === "accountants";
  const showDirectTable = billingSubTab === "all" || billingSubTab === "direct";
  const showManagedTable = billingSubTab === "all" || billingSubTab === "managed";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", fontFamily: "Heebo, sans-serif" }}>
      {/* Period Selector for KPIs */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: "12px",
        background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "10px",
      }}>
        <button onClick={() => setStatsPeriod(shiftPeriod(statsPeriod, -1))}
          style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "4px 8px", cursor: "pointer" }}>
          <ChevronRight size={16} />
        </button>
        <span style={{ fontSize: "14px", fontWeight: 600, color: "#1e3a5f", minWidth: "140px", textAlign: "center" }}>
          {fmtPeriod(statsPeriod)}
        </span>
        <button onClick={() => setStatsPeriod(shiftPeriod(statsPeriod, 1))}
          style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "4px 8px", cursor: "pointer" }}>
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <div key={i} style={{
              background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <Icon size={16} color={k.color} />
                <span style={{ fontSize: "12px", color: "#64748b" }}>{k.label}</span>
              </div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: k.color }}>{k.value}</div>
            </div>
          );
        })}
      </div>

      {/* Sub-tabs */}
      <div style={isMobile ? { display: "flex", gap: "6px", overflowX: "auto", scrollbarWidth: "none", padding: "4px", background: "#f1f5f9", borderRadius: "10px", WebkitOverflowScrolling: "touch" } : { display: "flex", gap: "6px", background: "#f1f5f9", padding: "4px", borderRadius: "10px", width: "fit-content" }}>
        {[
          { k: "all", label: "📊 הכל", count: allLogs.length },
          { k: "accountants", label: "🏢 רואי חשבון", count: allLogs.filter((l: any) => l.entity_type === "accountant").length },
          { k: "direct", label: "👤 לקוחות ישירים", count: allLogs.filter((l: any) => l.entity_type === "client_direct").length },
          { k: "managed", label: "🔗 לקוחות מנוהלים", count: allLogs.filter((l: any) => l.entity_type === "client_managed").length },
        ].map((t) => (
          <button key={t.k}
            onClick={() => setBillingSubTab(t.k as any)}
            style={{
              padding: "6px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
              border: "none", cursor: "pointer", fontFamily: "Heebo, sans-serif",
              background: billingSubTab === t.k ? "#1e3a5f" : "transparent",
              color: billingSubTab === t.k ? "#ffffff" : "#64748b",
              flexShrink: 0, whiteSpace: "nowrap",
            }}>
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* Filter banner */}
      {initialAccountantId && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "10px",
          padding: "10px 14px", color: "#1e40af", fontSize: "13px", fontWeight: 600,
        }}>
          <span>מסונן לפי: {accountantNameById.get(initialAccountantId) ?? "—"}</span>
          <button onClick={() => { onClearFilter?.(); setBillingSubTab("all"); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#1e40af", display: "flex", alignItems: "center", gap: "4px" }}>
            <X size={14} /> נקה פילטר
          </button>
        </div>
      )}

      {/* ACCOUNTANTS TABLE */}
      {showAccountantsTable && (
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
          <div style={{
            padding: "14px 18px", borderBottom: "1px solid #e2e8f0",
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap",
          }}>
            <h3 style={{ margin: 0, fontSize: "16px", color: "#1e3a5f", fontWeight: 700 }}>
              רואי חשבון — חיוב חודשי
            </h3>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                placeholder="חיפוש רו״ח..." value={accSearch}
                onChange={(e) => setAccSearch(e.target.value)}
                style={inputStyle}
              />
              <button onClick={generateAllBills} disabled={generateAllLoading}
                style={{
                  padding: "6px 14px", borderRadius: "6px", fontSize: "13px",
                  backgroundColor: "#e8941a", color: "#ffffff", border: "none",
                  cursor: generateAllLoading ? "not-allowed" : "pointer",
                  fontFamily: "Heebo, sans-serif", display: "inline-flex", alignItems: "center", gap: "6px",
                  opacity: generateAllLoading ? 0.6 : 1,
                }}>
                <Zap size={14} /> {generateAllLoading ? "מחשב..." : "חשב לכולם"}
              </button>
            </div>
          </div>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", width: "100%" }}>
            <table style={{ minWidth: "700px", width: "100%", borderCollapse: "collapse", fontSize: "12px", tableLayout: "fixed" }}>
              <thead>
                <tr style={{ background: "#f8fafc", textAlign: "right" }}>
                  {["שם", "בסיס לקוחות", "מחיר בסיס", "מחיר נוסף", "יום חיוב", "חינם", "חיוב חודשי משוער", "פעולה"].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", fontSize: "12px", color: "#64748b", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAccountants.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: "24px", textAlign: "center", color: "#94a3b8" }}>אין רואי חשבון פעילים</td></tr>
                )}
                {filteredAccountants.map((acc: any) => {
                  const calc = calcAccountantBill(acc.base_client_count ?? 10, acc.base_client_count ?? 10, acc.monthly_fee ?? 0, acc.price_per_client ?? 0);
                  const isFree = (acc.free_months ?? 0) > 0;
                  const alreadyBilled = billedAccountantIds.has(acc.id);
                  return (
                    <tr key={acc.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 600, color: "#1e3a5f" }}>{acc.name}</td>
                      <td style={{ padding: "10px 14px" }}>{acc.base_client_count ?? 10}</td>
                      <td style={{ padding: "10px 14px" }}>{fmt(acc.monthly_fee ?? 0)}</td>
                      <td style={{ padding: "10px 14px" }}>{fmt(acc.price_per_client ?? 0)} / לקוח</td>
                      <td style={{ padding: "10px 14px" }}>{acc.billing_day ?? 1} לחודש</td>
                      <td style={{ padding: "10px 14px" }}>
                        {isFree ? <span style={{ background: "#f8fafc", color: "#64748b", padding: "2px 8px", borderRadius: "10px", fontSize: "11px" }}>{acc.free_months} חודשים</span> : "—"}
                      </td>
                      <td style={{ padding: "10px 14px", fontWeight: 600 }}>
                        {isFree ? "פטור" : fmt(calc.totalBeforeVat)}
                        {!isFree && <div style={{ fontSize: "10px", color: "#94a3b8" }}>לפני מע"מ</div>}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <button
                          onClick={() => generateAccountantBill(acc, acc.base_client_count ?? 10)}
                          disabled={alreadyBilled}
                          title={alreadyBilled ? "חיוב קיים לתקופה זו" : ""}
                          style={{
                            padding: "5px 12px", borderRadius: "6px", fontSize: "12px",
                            backgroundColor: alreadyBilled ? "#cbd5e1" : "#1e3a5f",
                            color: "#ffffff", border: "none",
                            cursor: alreadyBilled ? "not-allowed" : "pointer",
                            fontFamily: "Heebo, sans-serif", display: "inline-flex", alignItems: "center", gap: "4px",
                          }}>
                          <Plus size={12} /> צור חיוב
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DIRECT CLIENTS TABLE */}
      {showDirectTable && (
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #e2e8f0" }}>
            <h3 style={{ margin: 0, fontSize: "16px", color: "#1e3a5f", fontWeight: 700 }}>לקוחות ישירים — חיוב חודשי</h3>
          </div>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", width: "100%" }}>
            <table style={{ minWidth: "650px", width: "100%", borderCollapse: "collapse", fontSize: "12px", tableLayout: "fixed" }}>
              <thead>
                <tr style={{ background: "#f8fafc", textAlign: "right" }}>
                  {["שם עסק", "חבילה", "מחזור", "מחיר", "יום חיוב", "חינם", "חיוב משוער", "פעולה"].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", fontSize: "12px", color: "#64748b", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {directClients.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: "24px", textAlign: "center", color: "#94a3b8" }}>אין לקוחות ישירים</td></tr>
                )}
                {directClients.map((c: any) => {
                  const isFree = (c.free_months ?? 0) > 0;
                  const planMonthly = c.plans?.monthly_price ?? c.monthly_price ?? 0;
                  const planYearly = c.plans?.yearly_price ?? c.yearly_price ?? 0;
                  const amount = c.billing_cycle === "yearly"
                    ? (c.locked_yearly_price ?? planYearly)
                    : (c.locked_monthly_price ?? planMonthly);
                  const alreadyBilled = billedDirectIds.has(c.id);
                  return (
                    <tr key={c.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 600, color: "#1e3a5f" }}>{c.brand_name ?? c.legal_name}</td>
                      <td style={{ padding: "10px 14px" }}>{c.plans?.name ?? "—"}</td>
                      <td style={{ padding: "10px 14px" }}>{c.billing_cycle === "yearly" ? "שנתי" : "חודשי"}</td>
                      <td style={{ padding: "10px 14px" }}>{fmt(amount)}</td>
                      <td style={{ padding: "10px 14px" }}>{c.billing_day ?? 1}</td>
                      <td style={{ padding: "10px 14px" }}>
                        {isFree ? <span style={{ background: "#f8fafc", color: "#64748b", padding: "2px 8px", borderRadius: "10px", fontSize: "11px" }}>{c.free_months} חודשים</span> : "—"}
                      </td>
                      <td style={{ padding: "10px 14px", fontWeight: 600 }}>{isFree ? "פטור" : fmt(amount)}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <button onClick={() => generateClientBill(c)} disabled={alreadyBilled}
                          title={alreadyBilled ? "חיוב קיים לתקופה זו" : ""}
                          style={{
                            padding: "5px 12px", borderRadius: "6px", fontSize: "12px",
                            backgroundColor: alreadyBilled ? "#cbd5e1" : "#e8941a",
                            color: "#ffffff", border: "none",
                            cursor: alreadyBilled ? "not-allowed" : "pointer",
                            fontFamily: "Heebo, sans-serif", display: "inline-flex", alignItems: "center", gap: "4px",
                          }}>
                          <Plus size={12} /> צור חיוב
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MANAGED CLIENTS TABLE */}
      {showManagedTable && (
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #e2e8f0" }}>
            <h3 style={{ margin: 0, fontSize: "16px", color: "#1e3a5f", fontWeight: 700 }}>לקוחות מנוהלים — מכוסים ע״י רו״ח</h3>
            <div style={{ marginTop: "6px", fontSize: "12px", color: "#64748b" }}>
              לקוחות אלו מחוייבים דרך רואה החשבון שלהם
            </div>
          </div>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", width: "100%" }}>
            <table style={{ minWidth: "450px", width: "100%", borderCollapse: "collapse", fontSize: "12px", tableLayout: "fixed" }}>
              <thead>
                <tr style={{ background: "#f8fafc", textAlign: "right" }}>
                  {["שם עסק", "רו\"ח אחראי", "חבילת רו\"ח", "סטטוס"].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", fontSize: "12px", color: "#64748b", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {managedClients.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: "24px", textAlign: "center", color: "#94a3b8" }}>אין לקוחות מנוהלים</td></tr>
                )}
                {managedClients.map((c: any) => (
                  <tr key={c.id ?? c.accountant_id} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: "#1e3a5f" }}>{c.brand_name ?? c.legal_name ?? "—"}</td>
                    <td style={{ padding: "10px 14px" }}>{c.accountant_name}</td>
                    <td style={{ padding: "10px 14px" }}>{c.plan_type ?? "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ background: "#f0fdf4", color: "#16a34a", padding: "3px 10px", borderRadius: "10px", fontSize: "11px", fontWeight: 600 }}>
                        מכוסה ✓
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* HISTORY */}
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
        <div style={{
          padding: "14px 18px", borderBottom: "1px solid #e2e8f0",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap",
        }}>
          <h3 style={{ margin: 0, fontSize: "16px", color: "#1e3a5f", fontWeight: 700 }}>היסטוריית חיוב</h3>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input placeholder="חיפוש שם..." value={searchName} onChange={(e) => setSearchName(e.target.value)}
                style={{ ...inputStyle, paddingRight: "30px" }} />
            </div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={inputStyle}>
              <option value="">כל הסטטוסים</option>
              <option value="pending">ממתין</option>
              <option value="paid">שולם</option>
              <option value="failed">נכשל</option>
              <option value="waived">פטור</option>
            </select>
            <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)} style={inputStyle}>
              <option value="">כל התקופות</option>
              {last12Months().map((p) => <option key={p} value={p}>{fmtPeriod(p)}</option>)}
            </select>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={inputStyle}>
              <option value="">כל הסוגים</option>
              <option value="accountant">רו"ח</option>
              <option value="client_direct">לקוח ישיר</option>
              <option value="client_managed">לקוח מנוהל</option>
            </select>
          </div>
        </div>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", width: "100%" }}>
          <table style={{ minWidth: "950px", width: "100%", borderCollapse: "collapse", fontSize: "11px", tableLayout: "fixed" }}>
            <thead>
              <tr style={{ background: "#f8fafc", textAlign: "right" }}>
                {["שם", "סוג", "תקופה", "בסיס", "נוספים", 'לפני מע"מ', 'מע"מ', 'כולל מע"מ', "אסמכתא", "שולם ב", "סטטוס", "פעולות"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", fontSize: "12px", color: "#64748b", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logsLoading ? (
                <tr><td colSpan={12} style={{ padding: "24px", textAlign: "center", color: "#94a3b8" }}>טוען...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan={12} style={{ padding: "24px", textAlign: "center", color: "#94a3b8" }}>אין רשומות</td></tr>
              ) : (
                filteredLogs.map((log: any) => {
                  const st = STATUS_MAP[log.status as StatusKey] ?? STATUS_MAP.pending;
                  const Icon = st.icon;
                  const tb = TYPE_BADGE[log.entity_type] ?? TYPE_BADGE.accountant;
                  const noteShort = log.notes && log.notes.length > 20 ? log.notes.slice(0, 20) + "…" : (log.notes ?? "—");
                  return (
                    <tr key={log.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 600, color: "#1e3a5f" }}>{log.entity_name ?? "—"}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ background: tb.bg, color: tb.color, padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: 600 }}>
                          {tb.label}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px" }}>{fmtPeriod(log.billing_period)}</td>
                      <td style={{ padding: "10px 14px" }}>{fmt(log.base_amount)}</td>
                      <td style={{ padding: "10px 14px" }}>{fmt(log.extra_amount)}</td>
                      <td style={{ padding: "10px 14px" }}>{fmt(log.total_before_vat)}</td>
                      <td style={{ padding: "10px 14px" }}>{fmt(log.vat_amount)}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 600 }}>{fmt(log.total_with_vat)}</td>
                      <td style={{ padding: "10px 14px", color: "#64748b" }} title={log.notes ?? ""}>{noteShort}</td>
                      <td style={{ padding: "10px 14px" }}>{fmtDate(log.paid_at)}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: "4px",
                          background: st.bg, color: st.color,
                          padding: "3px 10px", borderRadius: "10px", fontSize: "11px", fontWeight: 600,
                        }}>
                          <Icon size={12} /> {st.label}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                          {log.status === "pending" && (
                            <>
                              <button
                                onClick={() => {
                                  setShowMarkPaidModal(log);
                                  setMarkPaidMethod("external");
                                  setMarkPaidNotes("");
                                  setMarkPaidExtId("");
                                }}
                                title="סמן שולם"
                                style={{
                                  padding: "4px 8px", borderRadius: "6px", fontSize: "11px",
                                  backgroundColor: "#16a34a", color: "#ffffff", border: "none", cursor: "pointer",
                                  fontFamily: "Heebo, sans-serif",
                                }}>
                                ✓
                              </button>
                              <button
                                onClick={() => { setShowWaiveModal(log); setWaiveReason(""); }}
                                title="ויתור"
                                style={{
                                  padding: "4px 8px", borderRadius: "6px", fontSize: "11px",
                                  backgroundColor: "#64748b", color: "#ffffff", border: "none", cursor: "pointer",
                                  fontFamily: "Heebo, sans-serif",
                                }}>
                                🎁
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => {
                              if (window.confirm("למחוק רשומת חיוב זו?")) deleteEntry.mutate(log.id);
                            }}
                            title="מחק"
                            style={{
                              padding: "4px 8px", borderRadius: "6px", fontSize: "11px",
                              backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", cursor: "pointer",
                              fontFamily: "Heebo, sans-serif", display: "inline-flex", alignItems: "center",
                            }}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MARK PAID MODAL */}
      {showMarkPaidModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setShowMarkPaidModal(null)}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "#ffffff", borderRadius: "12px", padding: "24px", width: "min(440px, 92vw)", fontFamily: "Heebo, sans-serif" }}>
            <h3 style={{ margin: 0, marginBottom: "10px", color: "#1e3a5f", fontSize: "18px" }}>סימון תשלום</h3>
            <div style={{ marginBottom: "16px", color: "#64748b", fontSize: "13px" }}>
              סכום: {fmt(showMarkPaidModal.total_with_vat)} כולל מע"מ
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", color: "#1e3a5f", fontWeight: 600 }}>אמצעי תשלום</label>
              <select value={markPaidMethod} onChange={(e) => setMarkPaidMethod(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "14px", fontFamily: "Heebo, sans-serif" }}>
                <option value="external">חיצוני (העברה/מזומן)</option>
                <option value="internal">במערכת</option>
                <option value="auto">סליקה אוטומטית</option>
              </select>
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", color: "#1e3a5f", fontWeight: 600 }}>מזהה עסקה חיצוני</label>
              <input type="text" value={markPaidExtId} onChange={(e) => setMarkPaidExtId(e.target.value)}
                placeholder="TXN-12345"
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "14px", fontFamily: "Heebo, sans-serif", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", color: "#1e3a5f", fontWeight: 600 }}>הערה (אופציונלי)</label>
              <input type="text" value={markPaidNotes} onChange={(e) => setMarkPaidNotes(e.target.value)}
                placeholder="הערה נוספת"
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "14px", fontFamily: "Heebo, sans-serif", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowMarkPaidModal(null)}
                style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#ffffff", color: "#64748b", cursor: "pointer", fontSize: "13px", fontFamily: "Heebo, sans-serif" }}>
                ביטול
              </button>
              <button
                onClick={async () => {
                  await updateStatus.mutateAsync({
                    id: showMarkPaidModal.id, status: "paid",
                    payment_method: markPaidMethod,
                    notes: markPaidNotes || undefined,
                    external_payment_id: markPaidExtId || undefined,
                  });
                  setShowMarkPaidModal(null);
                }}
                style={{ padding: "8px 16px", borderRadius: "8px", border: "none", backgroundColor: "#16a34a", color: "#ffffff", cursor: "pointer", fontSize: "13px", fontFamily: "Heebo, sans-serif" }}>
                ✓ אשר תשלום
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WAIVE MODAL */}
      {showWaiveModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setShowWaiveModal(null)}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "#ffffff", borderRadius: "12px", padding: "24px", width: "min(420px, 92vw)", fontFamily: "Heebo, sans-serif" }}>
            <h3 style={{ margin: 0, marginBottom: "10px", color: "#1e3a5f", fontSize: "18px" }}>ויתור על חיוב</h3>
            <div style={{ marginBottom: "16px", color: "#64748b", fontSize: "13px" }}>
              סכום: {fmt(showWaiveModal.total_with_vat)} כולל מע"מ
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", color: "#1e3a5f", fontWeight: 600 }}>סיבה לויתור</label>
              <textarea value={waiveReason} onChange={(e) => setWaiveReason(e.target.value)}
                rows={3} placeholder="לדוגמה: חודש מתנה, פיצוי, וכו׳"
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "14px", fontFamily: "Heebo, sans-serif", boxSizing: "border-box", resize: "vertical" }} />
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowWaiveModal(null)}
                style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#ffffff", color: "#64748b", cursor: "pointer", fontSize: "13px", fontFamily: "Heebo, sans-serif" }}>
                ביטול
              </button>
              <button
                onClick={async () => {
                  await waiveEntry.mutateAsync({ id: showWaiveModal.id, notes: waiveReason || undefined });
                  setShowWaiveModal(null);
                }}
                style={{ padding: "8px 16px", borderRadius: "8px", border: "none", backgroundColor: "#64748b", color: "#ffffff", cursor: "pointer", fontSize: "13px", fontFamily: "Heebo, sans-serif" }}>
                🎁 אשר ויתור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
