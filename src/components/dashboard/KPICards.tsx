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
  if (previous === 0) return { pct: 0, direction: "flat" };
  const pct = ((current - previous) / previous) * 100;
  return { pct: Math.abs(pct), direction: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
}

interface KPICardsProps {
  kpis: { totalExpenses: number; totalVat: number; totalTax: number; count: number; noAllocation: number } | undefined;
  prevKpis?: { totalExpenses: number; totalVat: number; totalTax: number; count: number; noAllocation: number } | undefined;
  isLoading: boolean;
}

export default function KPICards({ kpis, prevKpis, isLoading }: KPICardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        {KPI_CARDS.map((c) => (
          <div key={c.key} className="rounded-xl bg-card p-5 shadow-[0_4px_12px_rgba(0,0,0,.08)]" style={{ borderRight: `4px solid ${c.color}` }}>
            <Skeleton className="mb-3 h-3 w-20" />
            <Skeleton className="mb-2 h-8 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (!kpis || (kpis.count === 0 && kpis.totalExpenses === 0)) {
    return (
      <div className="flex flex-col items-center gap-2 py-16">
        <Receipt className="text-muted-foreground" size={40} strokeWidth={1.5} />
        <p className="text-muted-foreground">אין נתונים לתקופה זו</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
      {KPI_CARDS.map((card) => {
        const Icon = card.icon;
        const value = kpis[card.key as keyof typeof kpis] as number;
        const prevValue = prevKpis ? (prevKpis[card.key as keyof typeof prevKpis] as number) : undefined;
        const delta = prevValue !== undefined ? calcDelta(value, prevValue) : null;

        return (
          <div
            key={card.key}
            className="relative overflow-hidden rounded-xl bg-card p-5 shadow-[0_4px_12px_rgba(0,0,0,.08)]"
            style={{ borderRight: `4px solid ${card.color}` }}
          >
            <Icon className="absolute top-4 left-4 opacity-[0.12]" size={20} />
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.5px] text-muted-foreground">
              {card.label}
            </p>
            <p className="text-[28px] font-black text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
              {card.format ? formatCurrency(value) : value}
            </p>
            {delta && delta.direction !== "flat" && (
              <div className="mt-1 flex items-center gap-1">
                {delta.direction === "up" ? (
                  <TrendingUp size={14} className="text-[#16a34a]" />
                ) : (
                  <TrendingDown size={14} className="text-[#dc2626]" />
                )}
                <span
                  className="text-[12px] font-medium"
                  style={{ color: delta.direction === "up" ? "#16a34a" : "#dc2626" }}
                >
                  {delta.pct.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
