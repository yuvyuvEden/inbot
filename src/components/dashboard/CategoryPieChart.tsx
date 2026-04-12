import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChartIcon } from "lucide-react";

const COLORS = ["#1e3a5f", "#e8941a", "#16a34a", "#7c3aed", "#dc2626", "#0284c7", "#f59e0b", "#64748b"];

interface CategoryPieChartProps {
  data: { name: string; value: number }[] | undefined;
  isLoading: boolean;
}

export default function CategoryPieChart({ data, isLoading }: CategoryPieChartProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl bg-card p-5 shadow-[0_4px_12px_rgba(0,0,0,.08)]">
        <Skeleton className="mb-4 h-4 w-28" />
        <Skeleton className="mx-auto h-[250px] w-[250px] rounded-full" />
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl bg-card p-5 shadow-[0_4px_12px_rgba(0,0,0,.08)]" style={{ minHeight: 300 }}>
        <PieChartIcon className="mb-2 text-muted-foreground" size={32} strokeWidth={1.5} />
        <p className="text-muted-foreground text-sm">אין נתונים לתקופה זו</p>
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="rounded-xl bg-card p-5 shadow-[0_4px_12px_rgba(0,0,0,.08)]">
      <h3 className="mb-4 text-[14px] font-bold text-foreground">פילוח קטגוריות</h3>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((_, idx) => (
              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, direction: "rtl" }}
            formatter={(value: number) => [`₪${value.toLocaleString("he-IL")}`, ""]}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {data.map((entry, idx) => (
          <div key={entry.name} className="flex items-center gap-1.5 text-[12px]">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="font-medium text-foreground">₪{entry.value.toLocaleString("he-IL", { maximumFractionDigits: 0 })}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
