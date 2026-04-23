import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Wallet, Landmark, Receipt, FileWarning, Hash } from "lucide-react";

const KPI_CARDS = [
  {
    key: "totalExpenses",
    label: "סה״כ הוצאות",
    gradient: "linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)",
    format: true,
    icon: Wallet,
  },
  {
    key: "totalVat",
    label: "מע״מ לקיזוז",
    gradient: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
    format: true,
    icon: Landmark,
  },
  {
    key: "totalTax",
    label: "הוצאה מוכרת",
    gradient: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
    format: true,
    icon: Receipt,
  },
  {
    key: "count",
    label: "חשבוניות",
    gradient: "linear-gradient(135deg, #e8941a 0%, #c2770f 100%)",
    format: false,
    icon: Hash,
  },
  {
    key: "noAllocation",
    label: "ללא הקצאה",
    gradient: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
    format: false,
    icon: FileWarning,
  },
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
              borderRadius: "16px",
              height: "120px",
              padding: "20px",
              background: "linear-gradient(135deg, #e2e8f0, #f1f5f9)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-7 w-28 self-end" />
            <Skeleton className="h-3 w-32 self-end" />
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
              position: "relative",
              overflow: "hidden",
              borderRadius: "16px",
              padding: "20px",
              background: card.gradient,
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
                {card.label}
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
              {card.format ? formatCurrency(value) : value}
            </p>

            {/* Delta */}
            {delta && delta.direction !== "flat" && (
              <div style={{ display: "flex", alignItems: "center", gap: "4px", justifyContent: "flex-end", position: "relative", zIndex: 1 }}>
                {delta.direction === "up"
                  ? <TrendingUp size={13} style={{ color: "rgba(255,255,255,0.9)" }} />
                  : <TrendingDown size={13} style={{ color: "rgba(255,255,255,0.9)" }} />
                }
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>
                  {delta.pct.toFixed(1)}% מהתקופה הקודמת
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
