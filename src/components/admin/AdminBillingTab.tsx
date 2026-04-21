import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useBillingLog,
  useBillingStats,
  useCreateBillingEntry,
  useUpdateBillingStatus,
  calcAccountantBill,
} from "@/hooks/useBilling";
import { CheckCircle, Clock, XCircle, Gift, Plus, RefreshCw } from "lucide-react";

const fmt = (n: number) =>
  "₪" +
  Number(n).toLocaleString("he-IL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtPeriod = (p: string) => {
  const [y, m] = p.split("-");
  const months = [
    "",
    "ינואר",
    "פברואר",
    "מרץ",
    "אפריל",
    "מאי",
    "יוני",
    "יולי",
    "אוגוסט",
    "ספטמבר",
    "אוקטובר",
    "נובמבר",
    "דצמבר",
  ];
  return `${months[parseInt(m)]} ${y}`;
};

type StatusKey = "pending" | "paid" | "failed" | "waived";

const STATUS_MAP: Record<
  StatusKey,
  { label: string; bg: string; color: string; icon: typeof Clock }
> = {
  pending: { label: "ממתין", bg: "#fff7ed", color: "#ea580c", icon: Clock },
  paid: { label: "שולם", bg: "#f0fdf4", color: "#16a34a", icon: CheckCircle },
  failed: { label: "נכשל", bg: "#fef2f2", color: "#dc2626", icon: XCircle },
  waived: { label: "פטור", bg: "#f8fafc", color: "#64748b", icon: Gift },
};

export function AdminBillingTab() {
  const { data: stats, isLoading: statsLoading } = useBillingStats();
  const { data: allLogs = [], isLoading: logsLoading } = useBillingLog();
  const updateStatus = useUpdateBillingStatus();
  const createEntry = useCreateBillingEntry();

  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [showMarkPaidModal, setShowMarkPaidModal] = useState<any | null>(null);
  const [markPaidMethod, setMarkPaidMethod] = useState("external");
  const [markPaidNotes, setMarkPaidNotes] = useState("");

  // שליפת רשימת רו"חים
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

  const filtered = allLogs.filter((l: any) => {
    if (filterStatus && l.status !== filterStatus) return false;
    if (filterType && l.entity_type !== filterType) return false;
    return true;
  });

  const kpis = [
    {
      label: "הכנסה צפויה החודש",
      value: fmt(stats?.expectedRevenue ?? 0),
      color: "#1e3a5f",
      icon: RefreshCw,
    },
    {
      label: "גבייה בפועל",
      value: fmt(stats?.collectedRevenue ?? 0),
      color: "#16a34a",
      icon: CheckCircle,
    },
    {
      label: "ממתינים לתשלום",
      value: stats?.pendingCount ?? 0,
      color: "#ea580c",
      icon: Clock,
    },
    {
      label: "כשלו",
      value: stats?.failedCount ?? 0,
      color: "#dc2626",
      icon: XCircle,
    },
    {
      label: "פטורים",
      value: stats?.waivedCount ?? 0,
      color: "#64748b",
      icon: Gift,
    },
  ];

  // יצירת חיוב חדש לרו"ח
  const generateAccountantBill = async (acc: any, activeCount: number) => {
    const currentPeriod = new Date().toISOString().slice(0, 7);
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
      billing_period: currentPeriod,
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
      await supabase
        .from("accountants")
        .update({ free_months: acc.free_months - 1 })
        .eq("id", acc.id);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", fontFamily: "Heebo, sans-serif" }}>
      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
        }}
      >
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <div
              key={i}
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <Icon size={16} color={k.color} />
                <span style={{ fontSize: "12px", color: "#64748b" }}>{k.label}</span>
              </div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: k.color }}>
                {statsLoading ? "..." : k.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* רשימת רו"חים לחיוב */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #e2e8f0" }}>
          <h3 style={{ margin: 0, fontSize: "16px", color: "#1e3a5f", fontWeight: 700 }}>
            רואי חשבון — חיוב חודשי
          </h3>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#f8fafc", textAlign: "right" }}>
                {[
                  "שם",
                  "בסיס לקוחות",
                  "מחיר בסיס",
                  "מחיר נוסף",
                  "יום חיוב",
                  "חינם",
                  "חיוב חודשי משוער",
                  "פעולה",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 14px",
                      fontSize: "12px",
                      color: "#64748b",
                      fontWeight: 600,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accountants.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: "24px", textAlign: "center", color: "#94a3b8" }}>
                    אין רואי חשבון פעילים
                  </td>
                </tr>
              )}
              {accountants.map((acc: any) => {
                const calc = calcAccountantBill(
                  acc.base_client_count ?? 10,
                  acc.base_client_count ?? 10,
                  acc.monthly_fee ?? 0,
                  acc.price_per_client ?? 0
                );
                const isFree = (acc.free_months ?? 0) > 0;
                return (
                  <tr key={acc.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: "#1e3a5f" }}>{acc.name}</td>
                    <td style={{ padding: "10px 14px" }}>{acc.base_client_count ?? 10}</td>
                    <td style={{ padding: "10px 14px" }}>{fmt(acc.monthly_fee ?? 0)}</td>
                    <td style={{ padding: "10px 14px" }}>{fmt(acc.price_per_client ?? 0)} / לקוח</td>
                    <td style={{ padding: "10px 14px" }}>{acc.billing_day ?? 1} לחודש</td>
                    <td style={{ padding: "10px 14px" }}>
                      {isFree ? (
                        <span
                          style={{
                            background: "#f8fafc",
                            color: "#64748b",
                            padding: "2px 8px",
                            borderRadius: "10px",
                            fontSize: "11px",
                          }}
                        >
                          {acc.free_months} חודשים
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ padding: "10px 14px", fontWeight: 600 }}>
                      {isFree ? "פטור" : fmt(calc.totalBeforeVat)}
                      {!isFree && (
                        <div style={{ fontSize: "10px", color: "#94a3b8" }}>לפני מע"מ</div>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <button
                        onClick={() =>
                          generateAccountantBill(acc, acc.base_client_count ?? 10)
                        }
                        style={{
                          padding: "5px 12px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          backgroundColor: "#1e3a5f",
                          color: "#ffffff",
                          border: "none",
                          cursor: "pointer",
                          fontFamily: "Heebo, sans-serif",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <Plus size={12} />
                        צור חיוב
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* לוג חיוב */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <h3 style={{ margin: 0, fontSize: "16px", color: "#1e3a5f", fontWeight: 700 }}>
            היסטוריית חיוב
          </h3>
          <div style={{ display: "flex", gap: "8px" }}>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
                fontSize: "13px",
                fontFamily: "Heebo, sans-serif",
              }}
            >
              <option value="">כל הסטטוסים</option>
              <option value="pending">ממתין</option>
              <option value="paid">שולם</option>
              <option value="failed">נכשל</option>
              <option value="waived">פטור</option>
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
                fontSize: "13px",
                fontFamily: "Heebo, sans-serif",
              }}
            >
              <option value="">הכל</option>
              <option value="accountant">רואי חשבון</option>
              <option value="client">לקוחות ישירים</option>
            </select>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#f8fafc", textAlign: "right" }}>
                {["סוג", "תקופה", "בסיס", "נוספים", 'לפני מע"מ', 'מע"מ', 'כולל מע"מ', "סטטוס", "פעולה"].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 14px",
                        fontSize: "12px",
                        color: "#64748b",
                        fontWeight: 600,
                      }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {logsLoading ? (
                <tr>
                  <td colSpan={9} style={{ padding: "24px", textAlign: "center", color: "#94a3b8" }}>
                    טוען...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: "24px", textAlign: "center", color: "#94a3b8" }}>
                    אין רשומות
                  </td>
                </tr>
              ) : (
                filtered.map((log: any) => {
                  const st = STATUS_MAP[log.status as StatusKey] ?? STATUS_MAP.pending;
                  const Icon = st.icon;
                  return (
                    <tr key={log.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 14px" }}>
                        <span
                          style={{
                            background: "#f1f5f9",
                            color: "#1e3a5f",
                            padding: "2px 8px",
                            borderRadius: "10px",
                            fontSize: "11px",
                          }}
                        >
                          {log.entity_type === "accountant" ? 'רו"ח' : "לקוח"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px" }}>{fmtPeriod(log.billing_period)}</td>
                      <td style={{ padding: "10px 14px" }}>{fmt(log.base_amount)}</td>
                      <td style={{ padding: "10px 14px" }}>{fmt(log.extra_amount)}</td>
                      <td style={{ padding: "10px 14px" }}>{fmt(log.total_before_vat)}</td>
                      <td style={{ padding: "10px 14px" }}>{fmt(log.vat_amount)}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 600 }}>
                        {fmt(log.total_with_vat)}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            background: st.bg,
                            color: st.color,
                            padding: "3px 10px",
                            borderRadius: "10px",
                            fontSize: "11px",
                            fontWeight: 600,
                          }}
                        >
                          <Icon size={12} />
                          {st.label}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        {log.status === "pending" && (
                          <button
                            onClick={() => {
                              setShowMarkPaidModal(log);
                              setMarkPaidMethod("external");
                              setMarkPaidNotes("");
                            }}
                            style={{
                              padding: "4px 10px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              backgroundColor: "#16a34a",
                              color: "#ffffff",
                              border: "none",
                              cursor: "pointer",
                              fontFamily: "Heebo, sans-serif",
                            }}
                          >
                            ✓ סמן שולם
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal — סמן כשולם */}
      {showMarkPaidModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowMarkPaidModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              padding: "24px",
              width: "min(420px, 92vw)",
              fontFamily: "Heebo, sans-serif",
            }}
          >
            <h3 style={{ margin: 0, marginBottom: "10px", color: "#1e3a5f", fontSize: "18px" }}>
              סימון תשלום
            </h3>
            <div style={{ marginBottom: "16px", color: "#64748b", fontSize: "13px" }}>
              סכום: {fmt(showMarkPaidModal.total_with_vat)} כולל מע"מ
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "6px",
                  fontSize: "13px",
                  color: "#1e3a5f",
                  fontWeight: 600,
                }}
              >
                אמצעי תשלום
              </label>
              <select
                value={markPaidMethod}
                onChange={(e) => setMarkPaidMethod(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  fontSize: "14px",
                  fontFamily: "Heebo, sans-serif",
                }}
              >
                <option value="external">חיצוני (העברה/מזומן)</option>
                <option value="internal">במערכת</option>
              </select>
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "6px",
                  fontSize: "13px",
                  color: "#1e3a5f",
                  fontWeight: 600,
                }}
              >
                הערה (אופציונלי)
              </label>
              <input
                type="text"
                value={markPaidNotes}
                onChange={(e) => setMarkPaidNotes(e.target.value)}
                placeholder="מספר אסמכתא / הערה"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  fontSize: "14px",
                  fontFamily: "Heebo, sans-serif",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowMarkPaidModal(null)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  color: "#64748b",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontFamily: "Heebo, sans-serif",
                }}
              >
                ביטול
              </button>
              <button
                onClick={async () => {
                  await updateStatus.mutateAsync({
                    id: showMarkPaidModal.id,
                    status: "paid",
                    payment_method: markPaidMethod,
                    notes: markPaidNotes || undefined,
                  });
                  setShowMarkPaidModal(null);
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: "#16a34a",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontFamily: "Heebo, sans-serif",
                }}
              >
                ✓ אשר תשלום
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
