import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  ChevronDown,
  ChevronUp,
  Search,
  Trash2,
  X,
  MoreVertical,
  History,
  FileText,
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

  const [billingSubTab, setBillingSubTab] = useState<"accountants" | "clients">("accountants");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPeriod, setFilterPeriod] = useState(currentMonthStr);
  const [filterType, setFilterType] = useState("");
  const [searchName, setSearchName] = useState("");
  const [accSearch, setAccSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [statsPeriod, setStatsPeriod] = useState(currentMonthStr);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [showMarkPaidModal, setShowMarkPaidModal] = useState<any | null>(null);
  const [markPaidMethod, setMarkPaidMethod] = useState("external");
  const [markPaidNotes, setMarkPaidNotes] = useState("");
  const [markPaidExtId, setMarkPaidExtId] = useState("");

  const [showWaiveModal, setShowWaiveModal] = useState<any | null>(null);
  const [waiveReason, setWaiveReason] = useState("");

  // Per-row dropdown menu (accountants table)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // History drawer for an accountant
  const [selectedAccountantHistory, setSelectedAccountantHistory] = useState<any | null>(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    if (initialAccountantId) setBillingSubTab("accountants");
  }, [initialAccountantId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!openMenuId) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", onDocClick);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", onDocClick);
    };
  }, [openMenuId]);

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
          "id, brand_name, legal_name, vat_number, plan_type, billing_cycle, billing_day, free_months, plan_expires_at, is_active, locked_monthly_price, locked_yearly_price, monthly_price, yearly_price, plan_id, plans(name, monthly_price, yearly_price)"
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
        .select("id, brand_name, legal_name, vat_number, plan_type, is_active")
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

  // סינון לוגים — היסטוריה כללית
  const filteredLogs = useMemo(() => {
    return allLogs.filter((l: any) => {
      if (filterStatus && l.status !== filterStatus) return false;
      if (filterPeriod && l.billing_period !== filterPeriod) return false;
      if (filterType && l.entity_type !== filterType) return false;
      if (
        searchName &&
        !(l.entity_name ?? "").toString().toLowerCase().includes(searchName.toLowerCase())
      )
        return false;
      if (initialAccountantId && l.entity_id !== initialAccountantId) return false;
      return true;
    });
  }, [allLogs, filterStatus, filterPeriod, filterType, searchName, initialAccountantId]);

  // לוגים של רו"ח נבחר (לדראוור)
  const accountantHistoryLogs = useMemo(() => {
    if (!selectedAccountantHistory) return [];
    return allLogs.filter(
      (l: any) =>
        l.entity_type === "accountant" && l.entity_id === selectedAccountantHistory.id
    );
  }, [allLogs, selectedAccountantHistory]);

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

  // איחוד לקוחות (ישירים + מנוהלים)
  const mergedClients = useMemo(() => {
    const direct = (directClients ?? []).map((c: any) => ({ ...c, _type: "direct" as const }));
    const managed = (managedClients ?? []).map((c: any) => ({ ...c, _type: "managed" as const }));
    const all = [...direct, ...managed];
    if (!clientSearch) return all;
    const q = clientSearch.toLowerCase();
    return all.filter((c: any) => {
      return (
        (c.brand_name ?? "").toLowerCase().includes(q) ||
        (c.legal_name ?? "").toLowerCase().includes(q) ||
        (c.vat_number ?? "").toLowerCase().includes(q) ||
        (c.accountant_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [directClients, managedClients, clientSearch]);

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

  const accountantNameById = useMemo(() => {
    const m = new Map<string, string>();
    accountants.forEach((a: any) => m.set(a.id, a.name));
    return m;
  }, [accountants]);

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
          { k: "accountants", label: "🏢 רואי חשבון", count: accountants.length },
          { k: "clients", label: "👤 לקוחות", count: (directClients?.length ?? 0) + (managedClients?.length ?? 0) },
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
          <button onClick={() => { onClearFilter?.(); setBillingSubTab("accountants"); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#1e40af", display: "flex", alignItems: "center", gap: "4px" }}>
            <X size={14} /> נקה פילטר
          </button>
        </div>
      )}

      {/* ACCOUNTANTS TABLE */}
      {billingSubTab === "accountants" && (
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "visible" }}>
          <div style={{
            padding: "14px 18px", borderBottom: "1px solid #e2e8f0",
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap",
          }}>
            <h3 style={{ margin: 0, fontSize: "16px", color: "#1e3a5f", fontWeight: 700 }}>
              רואי חשבון — חיוב חודשי
            </h3>
            <input
              placeholder="חיפוש רו״ח..." value={accSearch}
              onChange={(e) => setAccSearch(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", width: "100%", overflowY: "visible" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", minWidth: "780px" }}>
              <thead>
                <tr style={{ background: "#f8fafc", textAlign: "right" }}>
                  {["שם", "לקוחות פעילים", "חבילת בסיס", "מחיר לקוח נוסף", 'סה"כ משוער לפני מע"מ', "סטטוס חיוב החודש", "פעולות"].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", fontSize: "12px", color: "#64748b", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAccountants.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: "24px", textAlign: "center", color: "#94a3b8" }}>אין רואי חשבון פעילים</td></tr>
                )}
                {filteredAccountants.map((acc: any) => {
                  const activeCount = acc.base_client_count ?? 10;
                  const calc = calcAccountantBill(activeCount, acc.base_client_count ?? 10, acc.monthly_fee ?? 0, acc.price_per_client ?? 0);
                  const isFree = (acc.free_months ?? 0) > 0;
                  const alreadyBilled = billedAccountantIds.has(acc.id);
                  return (
                    <tr key={acc.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 600, color: "#1e3a5f" }}>{acc.name}</td>
                      <td style={{ padding: "10px 14px" }}>{activeCount}</td>
                      <td style={{ padding: "10px 14px" }}>{fmt(acc.monthly_fee ?? 0)}</td>
                      <td style={{ padding: "10px 14px" }}>{fmt(acc.price_per_client ?? 0)} / לקוח</td>
                      <td style={{ padding: "10px 14px", fontWeight: 600 }}>
                        {isFree ? "פטור" : fmt(calc.totalBeforeVat)}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        {alreadyBilled ? (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: "4px",
                            background: "#f0fdf4", color: "#16a34a",
                            padding: "3px 10px", borderRadius: "10px", fontSize: "11px", fontWeight: 600,
                          }}>
                            חויב ✓
                          </span>
                        ) : (
                          <span style={{
                            background: "#f1f5f9", color: "#64748b",
                            padding: "3px 10px", borderRadius: "10px", fontSize: "11px", fontWeight: 600,
                          }}>
                            טרם חויב
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ position: "relative" }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (openMenuId === acc.id) {
                                setOpenMenuId(null);
                              } else {
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                setMenuPos({ top: rect.bottom + 4, left: rect.left });
                                setOpenMenuId(acc.id);
                              }
                            }}
                            title="פעולות"
                            style={{
                              padding: "4px 8px", borderRadius: "6px",
                              backgroundColor: "transparent", color: "#64748b",
                              border: "1px solid #e2e8f0", cursor: "pointer",
                              display: "inline-flex", alignItems: "center",
                            }}>
                            <MoreVertical size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CLIENTS TABLE (direct + managed) */}
      {billingSubTab === "clients" && (
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
          <div style={{
            padding: "14px 18px", borderBottom: "1px solid #e2e8f0",
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap",
          }}>
            <h3 style={{ margin: 0, fontSize: "16px", color: "#1e3a5f", fontWeight: 700 }}>
              לקוחות — חיוב חודשי
            </h3>
            <input
              placeholder="חיפוש לפי שם / ע.מ / רו״ח..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              style={{ ...inputStyle, minWidth: "240px" }}
            />
          </div>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", width: "100%" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", minWidth: "760px" }}>
              <thead>
                <tr style={{ background: "#f8fafc", textAlign: "right" }}>
                  {["שם עסק", "סוג", 'רו"ח משויך', "חבילה", "מחיר", "סטטוס"].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", fontSize: "12px", color: "#64748b", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mergedClients.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: "24px", textAlign: "center", color: "#94a3b8" }}>אין לקוחות</td></tr>
                )}
                {mergedClients.map((c: any) => {
                  const isManaged = c._type === "managed";
                  const planMonthly = c.plans?.monthly_price ?? c.monthly_price ?? 0;
                  const planYearly = c.plans?.yearly_price ?? c.yearly_price ?? 0;
                  const amount = !isManaged
                    ? (c.billing_cycle === "yearly"
                      ? (c.locked_yearly_price ?? planYearly)
                      : (c.locked_monthly_price ?? planMonthly))
                    : 0;
                  const isFree = (c.free_months ?? 0) > 0;
                  const alreadyBilled = !isManaged && billedDirectIds.has(c.id);
                  return (
                    <tr key={`${c._type}-${c.id}`} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 600, color: "#1e3a5f" }}>
                        {c.brand_name ?? c.legal_name ?? "—"}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        {isManaged ? (
                          <span
                            title={`רו״ח: ${c.accountant_name}`}
                            style={{
                              background: "#eff6ff", color: "#1e40af",
                              padding: "2px 8px", borderRadius: "10px",
                              fontSize: "11px", fontWeight: 600,
                            }}>
                            🔵 מנוהל
                          </span>
                        ) : (
                          <span style={{
                            background: "#fff7ed", color: "#ea580c",
                            padding: "2px 8px", borderRadius: "10px",
                            fontSize: "11px", fontWeight: 600,
                          }}>
                            🟠 עצמאי
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        {isManaged ? c.accountant_name : "—"}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        {isManaged ? (c.plan_type ?? "—") : (c.plans?.name ?? c.plan_type ?? "—")}
                      </td>
                      <td style={{ padding: "10px 14px", fontWeight: 600 }}>
                        {isManaged ? "—" : (isFree ? "פטור" : fmt(amount))}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        {isManaged ? (
                          <span style={{ color: "#64748b", fontSize: "12px" }}>
                            מחוייב דרך רו״ח {c.accountant_name}
                          </span>
                        ) : (
                          <button
                            onClick={() => generateClientBill(c)}
                            disabled={alreadyBilled}
                            title={alreadyBilled ? "חיוב קיים לתקופה זו" : ""}
                            style={{
                              padding: "5px 12px", borderRadius: "6px", fontSize: "12px",
                              backgroundColor: alreadyBilled ? "#cbd5e1" : "#e8941a",
                              color: "#ffffff", border: "none",
                              cursor: alreadyBilled ? "not-allowed" : "pointer",
                              fontFamily: "Heebo, sans-serif",
                              display: "inline-flex", alignItems: "center", gap: "4px",
                            }}>
                            <Plus size={12} /> {alreadyBilled ? "חויב" : "צור חיוב"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* HISTORY (collapsible) */}
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
        <button
          onClick={() => setHistoryOpen((v) => !v)}
          style={{
            width: "100%", padding: "14px 18px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            background: "transparent", border: "none", cursor: "pointer",
            fontFamily: "Heebo, sans-serif", textAlign: "right",
          }}>
          <span style={{ fontSize: "16px", color: "#1e3a5f", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "8px" }}>
            <FileText size={16} /> 📋 היסטוריית חיוב ({allLogs.length} רשומות)
          </span>
          {historyOpen ? <ChevronUp size={18} color="#64748b" /> : <ChevronDown size={18} color="#64748b" />}
        </button>

        {historyOpen && (
          <>
            <div style={{
              padding: "12px 18px", borderTop: "1px solid #e2e8f0",
              display: "flex", justifyContent: "flex-end", gap: "8px", flexWrap: "wrap", alignItems: "center",
            }}>
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
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", width: "100%" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", minWidth: "900px" }}>
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
          </>
        )}
      </div>

      {/* ACCOUNTANT HISTORY DRAWER */}
      {selectedAccountantHistory && (
        <>
          <div
            onClick={() => setSelectedAccountantHistory(null)}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1100,
            }}
          />
          <div
            style={{
              position: "fixed", top: 0, right: 0, bottom: 0,
              width: "min(420px, 100vw)", background: "#ffffff",
              boxShadow: "-4px 0 16px rgba(15, 23, 42, 0.12)",
              zIndex: 1101, display: "flex", flexDirection: "column",
              fontFamily: "Heebo, sans-serif",
            }}>
            <div style={{
              padding: "14px 18px", borderBottom: "1px solid #e2e8f0",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "#1e3a5f", color: "#ffffff",
            }}>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>
                היסטוריית חיוב — {selectedAccountantHistory.name}
              </h3>
              <button
                onClick={() => setSelectedAccountantHistory(null)}
                style={{
                  background: "transparent", border: "none", color: "#ffffff",
                  cursor: "pointer", display: "flex", alignItems: "center",
                }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
              {accountantHistoryLogs.length === 0 ? (
                <div style={{ padding: "24px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                  אין רשומות חיוב לרו״ח זה
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", textAlign: "right" }}>
                      {["תקופה", 'לפני מע"מ', 'כולל מע"מ', "סטטוס"].map((h) => (
                        <th key={h} style={{ padding: "8px 6px", fontSize: "11px", color: "#64748b", fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {accountantHistoryLogs.map((log: any) => {
                      const st = STATUS_MAP[log.status as StatusKey] ?? STATUS_MAP.pending;
                      const Icon = st.icon;
                      return (
                        <tr key={log.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "8px 6px" }}>{fmtPeriod(log.billing_period)}</td>
                          <td style={{ padding: "8px 6px" }}>{fmt(log.total_before_vat)}</td>
                          <td style={{ padding: "8px 6px", fontWeight: 600 }}>{fmt(log.total_with_vat)}</td>
                          <td style={{ padding: "8px 6px" }}>
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: "3px",
                              background: st.bg, color: st.color,
                              padding: "2px 8px", borderRadius: "10px", fontSize: "10px", fontWeight: 600,
                            }}>
                              <Icon size={10} /> {st.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* MARK PAID MODAL */}
      {showMarkPaidModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1200 }}
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
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1200 }}
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

      {openMenuId && menuPos && (
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: menuPos.top,
            left: menuPos.left,
            zIndex: 9999,
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            boxShadow: "0 4px 16px rgba(15, 23, 42, 0.12)",
            minWidth: "180px",
            overflow: "hidden",
            fontFamily: "Heebo, sans-serif",
          }}
        >
          {filteredAccountants.filter((a: any) => a.id === openMenuId).map((acc: any) => {
            const activeCount = acc.base_client_count ?? 10;
            const alreadyBilled = billedAccountantIds.has(acc.id);
            return (
              <div key={acc.id}>
                <button
                  onClick={() => { setSelectedAccountantHistory(acc); setOpenMenuId(null); }}
                  style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    width: "100%", padding: "10px 12px", border: "none",
                    background: "transparent", textAlign: "right",
                    cursor: "pointer", fontSize: "13px", color: "#1e3a5f",
                    fontFamily: "Heebo, sans-serif",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <History size={14} /> 📄 היסטוריית חיוב
                </button>
                <button
                  onClick={async () => {
                    setOpenMenuId(null);
                    if (!alreadyBilled) await generateAccountantBill(acc, activeCount);
                  }}
                  disabled={alreadyBilled}
                  style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    width: "100%", padding: "10px 12px", border: "none",
                    borderTop: "1px solid #f1f5f9",
                    background: "transparent", textAlign: "right",
                    cursor: alreadyBilled ? "not-allowed" : "pointer",
                    opacity: alreadyBilled ? 0.5 : 1,
                    fontSize: "13px", color: "#1e3a5f",
                    fontFamily: "Heebo, sans-serif",
                  }}
                  onMouseEnter={(e) => { if (!alreadyBilled) e.currentTarget.style.background = "#f8fafc"; }}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <Plus size={14} /> ➕ צור חיוב ידני
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
