import { Skeleton } from "@/components/ui/skeleton";
import { FileText, ArrowLeft } from "lucide-react";

interface Invoice {
  id: string;
  invoice_date: string | null;
  vendor: string | null;
  total: number | null;
  category: string | null;
  status: string;
}

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  approved: { label: "מאושר", bg: "#dcfce7", text: "#16a34a" },
  pending_review: { label: "ממתין לבדיקה", bg: "#fff7ed", text: "#ea580c" },
  needs_clarification: { label: "דרוש הבהרה", bg: "#fef2f2", text: "#dc2626" },
  archived: { label: "בארכיון", bg: "#f1f5f9", text: "#64748b" },
};

function formatDate(d: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

interface RecentInvoicesTableProps {
  invoices: Invoice[] | undefined;
  isLoading: boolean;
  onViewAll?: () => void;
}

export default function RecentInvoicesTable({ invoices, isLoading, onViewAll }: RecentInvoicesTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl bg-card p-5 shadow-[0_4px_12px_rgba(0,0,0,.08)]">
        <Skeleton className="mb-4 h-4 w-32" />
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="mb-2 h-10 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!invoices?.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl bg-card p-5 shadow-[0_4px_12px_rgba(0,0,0,.08)] py-12">
        <FileText className="mb-2 text-muted-foreground" size={32} strokeWidth={1.5} />
        <p className="text-muted-foreground text-sm">אין חשבוניות אחרונות</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card p-5 shadow-[0_4px_12px_rgba(0,0,0,.08)] overflow-x-auto">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-foreground">חשבוניות אחרונות</h3>
        {onViewAll && (
          <button onClick={onViewAll} className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors">
            כל החשבוניות
            <ArrowLeft size={14} />
          </button>
        )}
      </div>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="pb-2 text-right font-medium">תאריך</th>
            <th className="pb-2 text-right font-medium">ספק</th>
            <th className="pb-2 text-right font-medium">סכום</th>
            <th className="pb-2 text-right font-medium">קטגוריה</th>
            <th className="pb-2 text-right font-medium">סטטוס</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => {
            const st = STATUS_MAP[inv.status] || STATUS_MAP.pending_review;
            return (
              <tr key={inv.id} className="border-b border-border/50 transition-colors hover:bg-secondary/50 cursor-pointer">
                <td className="py-3">{formatDate(inv.invoice_date)}</td>
                <td className="py-3">{inv.vendor || "—"}</td>
                <td className="py-3 font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {inv.total != null ? `₪${inv.total.toLocaleString("he-IL")}` : "—"}
                </td>
                <td className="py-3">{inv.category || "—"}</td>
                <td className="py-3">
                  <span
                    className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                    style={{ backgroundColor: st.bg, color: st.text }}
                  >
                    {st.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
