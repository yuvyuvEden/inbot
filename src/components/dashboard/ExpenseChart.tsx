import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp } from "lucide-react";

interface ExpenseChartProps {
  data: { date: string; total: number }[] | undefined;
  isLoading: boolean;
}

export default function ExpenseChart({ data, isLoading }: ExpenseChartProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl bg-card p-5 shadow-[0_4px_12px_rgba(0,0,0,.08)]">
        <Skeleton className="mb-4 h-4 w-32" />
        <Skeleton className="h-[250px] w-full rounded-lg" />
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl bg-card p-5 shadow-[0_4px_12px_rgba(0,0,0,.08)]" style={{ minHeight: 300 }}>
        <TrendingUp className="mb-2 text-muted-foreground" size={32} strokeWidth={1.5} />
        <p className="text-muted-foreground text-sm">אין נתונים לתקופה זו</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card p-5 shadow-[0_4px_12px_rgba(0,0,0,.08)]">
      <h3 className="mb-4 text-[14px] font-bold text-foreground">הוצאות לפי תקופה</h3>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="fillPrimary" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#1e3a5f" stopOpacity={0.08} />
              <stop offset="95%" stopColor="#1e3a5f" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} tickFormatter={(v) => `₪${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, direction: "rtl" }}
            formatter={(value: number) => [`₪${value.toLocaleString("he-IL")}`, "סכום"]}
            labelFormatter={(label) => label}
          />
          <Area type="monotone" dataKey="total" stroke="#1e3a5f" strokeWidth={2} fill="url(#fillPrimary)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
