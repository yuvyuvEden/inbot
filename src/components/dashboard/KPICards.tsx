import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Wallet, Landmark, Receipt, FileWarning, Hash } from "lucide-react";

const KPI_CARDS = [
  { key: "totalExpenses", label: "סה״כ הוצאות", color: "#1e3a5f", format: true, icon: Wallet },
  { key: "totalVat", label: "מע״מ לקיזוז", color: "#16a34a", format: true, icon: Landmark },
  { key: "totalTax", label: "הוצאה מוכרת מס", color: "#7c3aed", format: true, icon: Receipt },
  { key: "count", label: "חשבוניות", color: "#e8941a", format: false, icon: Hash },
  { key: "noAllocation", label: "ללא הקצאה", color: "#dc2626", format: false, icon: FileWarning },
] as const;

function formatCurrency(n: number) {
  return "₪" + n.toLocaleString("he-IL", { maximumFractionDigits: 0 });
}

function calcDelta(current: number, previous: number): { pct: number; direction: "up" | "down" | "flat" } {
  if (previous === 0 && current === 0) return { pct: 0, direction: "flat" };
  if (previous === 0) return { pct: 100, direction: "up" };
  const pct = ((current - previous) / previous) * 100;
  return { pct: Math.abs(pct), direction: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
}

interface KPIs { totalExpenses: number; totalVat: number; totalTax: number; count: number; noAllocation: number }

interface KPICardsProps {
  kpis: KPIs | undefined;
  prevKpis?: KPIs | undefined;
  isLoading: boolean;
}

export default function KPICards({ kpis, prevKpis, isLoading }: KPICardsProps) {
  if (isLoading) {
    return (
      <div
        dir="rtl"
        className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4"
        style={{ fontFamily: "Heebo, sans-serif" }}
      >
        {KPI_CARDS.map((c) => (
          <div
            key={c.key}
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              borderTop: `4px solid ${c.color}`,
              padding: "20px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.07)",
              minHeight: "130px",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-5 rounded" />
            </div>
            <Skeleton className="mb-2 h-8 w-28" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
    );
  }

  // Always show cards, even with 0 values
  const data: KPIs = kpis || { totalExpenses: 0, totalVat: 0, totalTax: 0, count: 0, noAllocation: 0 };

  return (
    <div
      dir="rtl"
      className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4"
      style={{ fontFamily: "Heebo, sans-serif" }}
    >
      {KPI_CARDS.map((card) => {
        const Icon = card.icon;
        const value = data[card.key as keyof KPIs] as number;
        const prevValue = prevKpis ? (prevKpis[card.key as keyof KPIs] as number) : undefined;
        const delta = prevValue !== undefined ? calcDelta(value, prevValue) : null;

        return (
          <div
            key={card.key}
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              borderTop: `4px solid ${card.color}`,
              padding: "20px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.07)",
              transition: "transform 0.18s ease, box-shadow 0.18s ease",
              cursor: "default",
              minHeight: "130px",
              display: "flex",
              flexDirection: "column",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.01)";
              e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.10)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.07)";
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "10px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "11px",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  color: "#64748b",
                }}
              >
                {card.label}
              </p>
              <Icon size={20} style={{ color: card.color, opacity: 0.7 }} />
            </div>

            <p
              style={{
                margin: 0,
                fontSize: "32px",
                fontWeight: 900,
                color: "#1a202c",
                lineHeight: 1.1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {card.format ? formatCurrency(value) : value}
            </p>

            {delta && (
              <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                {delta.direction === "up" && (
                  <>
                    <TrendingUp size={14} style={{ color: "#16a34a" }} />
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#16a34a" }}>
                      ↑ {delta.pct.toFixed(1)}%
                    </span>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>מהתקופה הקודמת</span>
                  </>
                )}
                {delta.direction === "down" && (
                  <>
                    <TrendingDown size={14} style={{ color: "#dc2626" }} />
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#dc2626" }}>
                      ↓ {delta.pct.toFixed(1)}%
                    </span>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>מהתקופה הקודמת</span>
                  </>
                )}
                {delta.direction === "flat" && (
                  <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 500 }}>
                    ללא שינוי
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
