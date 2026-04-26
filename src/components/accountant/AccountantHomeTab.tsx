import { useAccountantKPIs, useClientInvoiceCounts } from "@/hooks/useAccountantData";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Users, Clock, MessageSquare, CheckCircle, FileText } from "lucide-react";

interface Props {
  clients: any[];
  clientIds: string[];
}

export function AccountantHomeTab({ clients, clientIds }: Props) {
  const { data: kpis, isLoading: kpisLoading } = useAccountantKPIs(clientIds);
  const { data: counts = {} } = useClientInvoiceCounts(clientIds);
  const [filterUrgent, setFilterUrgent] = useState(false);
  const navigate = useNavigate();

  const fmt = (n: number) => "₪" + n.toLocaleString("he-IL", { maximumFractionDigits: 0 });

  const kpiCards = [
    {
      label: "סה״כ לקוחות",
      value: clients.filter((c: any) => c.is_active).length,
      gradient: "linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)",
      Icon: Users,
    },
    {
      label: "לבדיקה",
      value: kpis?.pendingReview ?? 0,
      gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
      Icon: Clock,
    },
    {
      label: "הבהרות",
      value: kpis?.needsClarification ?? 0,
      gradient: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
      Icon: MessageSquare,
    },
    {
      label: "נאספו החודש",
      value: kpis?.collectedThisMonth ?? 0,
      gradient: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
      Icon: FileText,
    },
    {
      label: "מאושרות החודש",
      value: kpis?.approvedThisMonth ?? 0,
      gradient: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
      Icon: CheckCircle,
    },
  ];

  const displayedClients = filterUrgent
    ? clients.filter((c: any) => {
        const cc = (counts as any)[c.id];
        return cc && (cc.pending > 0 || cc.clarification > 0);
      })
    : clients;

  const chip = (label: string, count: number, kind: "orange" | "red" | "gray") => {
    const active = count > 0 && kind !== "gray";
    let bg = "#f1f5f9";
    let color = "#64748b";
    if (active && kind === "orange") {
      bg = "#fef3e2";
      color = "#d97706";
    } else if (active && kind === "red") {
      bg = "#fef2f2";
      color = "#dc2626";
    }
    return (
      <span
        style={{
          background: bg,
          color,
          fontSize: "12px",
          fontWeight: active ? 700 : 500,
          padding: "4px 10px",
          borderRadius: "9999px",
          whiteSpace: "nowrap",
        }}
      >
        {label} {count}
      </span>
    );
  };

  return (
    <div
      dir="rtl"
      style={{ display: "flex", flexDirection: "column", gap: "24px", fontFamily: "Heebo, sans-serif" }}
    >
      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: "16px",
        }}
      >
        {kpiCards.map((k, i) => {
          const Icon = k.Icon;
          return (
            <div
              key={i}
              style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: "16px",
                padding: "20px",
                background: k.gradient,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                color: "#ffffff",
                minHeight: "120px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              {/* Background icon — large, faded */}
              <Icon
                size={64}
                style={{
                  position: "absolute",
                  bottom: "-8px",
                  left: "-8px",
                  opacity: 0.12,
                  color: "#ffffff",
                  pointerEvents: "none",
                }}
              />

              {/* Top row: label + small icon */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative", zIndex: 1 }}>
                <Icon size={18} style={{ opacity: 0.8, color: "#ffffff", flexShrink: 0 }} />
                <p style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.85)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  margin: 0,
                  textAlign: "right",
                }}>
                  {k.label}
                </p>
              </div>

              {/* Value */}
              <p style={{
                fontSize: "30px",
                fontWeight: 900,
                color: "#ffffff",
                margin: 0,
                fontVariantNumeric: "tabular-nums",
                textAlign: "right",
                position: "relative",
                zIndex: 1,
                lineHeight: 1.1,
              }}>
                {kpisLoading ? "…" : k.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Clients Section */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#1e3a5f", margin: 0 }}>
            {filterUrgent ? "לקוחות שצריכים טיפול" : "5 הלקוחות הפעילים ביותר"}
          </h2>
          <button
            onClick={() => setFilterUrgent((f) => !f)}
            style={{
              padding: "6px 14px",
              borderRadius: "9999px",
              fontSize: "13px",
              cursor: "pointer",
              border: "1px solid #e8941a",
              backgroundColor: filterUrgent ? "#e8941a" : "transparent",
              color: filterUrgent ? "#ffffff" : "#e8941a",
              fontFamily: "Heebo, sans-serif",
              fontWeight: 600,
              transition: "all 0.15s",
            }}
          >
            {filterUrgent ? "הצג הכל" : "🔴 צריך טיפול"}
          </button>
        </div>

        {displayedClients.length === 0 ? (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "48px 20px",
              textAlign: "center",
              color: "#16a34a",
              fontSize: "16px",
              fontWeight: 600,
            }}
          >
            <div style={{ fontSize: "36px", marginBottom: "8px" }}>✓</div>
            כל הלקוחות מטופלים
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {(() => {
              const toShow = filterUrgent
                ? displayedClients
                : [...displayedClients]
                    .sort((a: any, b: any) => {
                      const ca = (counts as any)[a.id]?.totalInvoices ?? 0;
                      const cb = (counts as any)[b.id]?.totalInvoices ?? 0;
                      return cb - ca;
                    })
                    .slice(0, 5);

              const maxInvoices = Math.max(
                ...toShow.map((c: any) => (counts as any)[c.id]?.totalInvoices ?? 0),
                1
              );

              return toShow.map((c: any) => {
                const cc = (counts as any)[c.id] ?? { monthlyTotal: 0, pending: 0, clarification: 0, archived: 0, totalInvoices: 0 };
                const pct = filterUrgent ? null : Math.round((cc.totalInvoices / maxInvoices) * 100);

                let stripeColor = "#16a34a";
                if (cc.pending > 0) stripeColor = "#dc2626";
                else if (cc.clarification > 0) stripeColor = "#f59e0b";

                return (
                  <div
                    key={c.id}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRight: `3px solid ${stripeColor}`,
                      borderRadius: "12px",
                      padding: "14px 18px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                      transition: "background 0.15s",
                      cursor: "default",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#f8fafc"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "#ffffff"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "160px" }}>
                        <span style={{ fontSize: "15px", fontWeight: 700, color: "#1e3a5f" }}>
                          {c.brand_name ?? "—"}
                        </span>
                        {c.plan_type && (
                          <span style={{ background: "#f0f4f8", color: "#64748b", fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "9999px", textTransform: "uppercase" }}>
                            {c.plan_type}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "8px", flex: 1, flexWrap: "wrap", justifyContent: "center" }}>
                        {chip("ממתין", cc.pending, "orange")}
                        {chip("הבהרה", cc.clarification, "red")}
                        {chip("חשבוניות", cc.totalInvoices, "gray")}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <button
                          onClick={() => navigate(`/accountant/client/${c.id}`)}
                          style={{ padding: "6px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, backgroundColor: "#1e3a5f", color: "#ffffff", border: "none", cursor: "pointer", fontFamily: "Heebo, sans-serif", whiteSpace: "nowrap" }}
                        >
                          כניסה ←
                        </button>
                      </div>
                    </div>
                    {pct !== null && (
                      <div style={{ height: "4px", background: "#f1f5f9", borderRadius: "9999px", overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: "#e8941a", borderRadius: "9999px", transition: "width 0.3s" }} />
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
