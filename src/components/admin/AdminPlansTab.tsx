import { useState } from "react";
import { usePlans, useUpdatePlan } from "@/hooks/usePlans";
import { useAuth } from "@/contexts/AuthContext";
import { Edit2, Check, X, History } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const fmt = (n: number) =>
  Number(n) === 0 ? "חינם" : "₪" + Number(n).toLocaleString("he-IL");
const fmtLimit = (n: number) => (Number(n) === 0 ? "∞" : String(n));

type EditValues = {
  monthly_price: number | string;
  yearly_price: number | string;
  user_limit: number | string;
  invoice_limit: number | string;
};

export function AdminPlansTab() {
  const { data: plans = [], isLoading } = usePlans();
  const updatePlan = useUpdatePlan();
  const { session } = useAuth() as any;
  const [editId, setEditId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<EditValues>({
    monthly_price: 0,
    yearly_price: 0,
    user_limit: 0,
    invoice_limit: 0,
  });
  const [applyToExisting, setApplyToExisting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const { data: history = [] } = useQuery({
    queryKey: ["plan-price-history"],
    enabled: showHistory,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_price_history")
        .select("*, plans(name)")
        .order("changed_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const startEdit = (plan: any) => {
    setEditId(plan.id);
    setEditValues({
      monthly_price: plan.monthly_price,
      yearly_price: plan.yearly_price,
      user_limit: plan.user_limit,
      invoice_limit: plan.invoice_limit,
    });
    setApplyToExisting(false);
  };

  const saveEdit = async () => {
    if (!editId) return;
    await updatePlan.mutateAsync({
      id: editId,
      updates: {
        monthly_price: Number(editValues.monthly_price),
        yearly_price: Number(editValues.yearly_price),
        user_limit: Number(editValues.user_limit),
        invoice_limit: Number(editValues.invoice_limit),
      },
      applyToExisting,
      changedBy: session?.user?.id ?? "",
    });
    setEditId(null);
  };

  const inputCls =
    "w-20 rounded-md border border-accent px-2 py-1 text-xs font-sans outline-none focus:ring-2 focus:ring-accent/40";

  return (
    <div className="space-y-6">
      {/* Plans table card */}
      <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-base font-bold text-primary">ניהול חבילות</h3>
          <button
            onClick={() => setShowHistory((h) => !h)}
            className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
          >
            <History size={14} />
            היסטוריית שינויים
          </button>
        </div>

        <div className="w-full overflow-hidden">
          <table className="w-full text-xs" style={{ tableLayout: "fixed" }}>
            <thead>
              <tr className="border-b border-border bg-secondary text-right text-xs font-semibold text-muted-foreground">
                {["שם חבילה", "מחיר חודשי", "מחיר שנתי", "משתמשים", "חשבוניות/חודש", "ימי ניסיון", "פעיל", "פעולה"].map(
                  (h) => (
                    <th key={h} className="p-3">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-muted-foreground">
                    טוען...
                  </td>
                </tr>
              ) : (
                plans.map((plan: any) => {
                  const isEditing = editId === plan.id;
                  return (
                    <tr key={plan.id} className="border-b border-border hover:bg-secondary/40">
                      <td className="p-3 font-bold text-primary">{plan.name}</td>
                      <td className="p-3">
                        {isEditing ? (
                          <input
                            type="number"
                            className={inputCls}
                            value={editValues.monthly_price}
                            onChange={(e) =>
                              setEditValues({ ...editValues, monthly_price: e.target.value })
                            }
                          />
                        ) : (
                          <span>{fmt(plan.monthly_price)}</span>
                        )}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <input
                            type="number"
                            className={inputCls}
                            value={editValues.yearly_price}
                            onChange={(e) =>
                              setEditValues({ ...editValues, yearly_price: e.target.value })
                            }
                          />
                        ) : (
                          <span>{fmt(plan.yearly_price)}</span>
                        )}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <input
                            type="number"
                            className={inputCls + " w-16"}
                            value={editValues.user_limit}
                            onChange={(e) =>
                              setEditValues({ ...editValues, user_limit: e.target.value })
                            }
                          />
                        ) : (
                          <span>{fmtLimit(plan.user_limit)}</span>
                        )}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <input
                            type="number"
                            className={inputCls + " w-16"}
                            value={editValues.invoice_limit}
                            onChange={(e) =>
                              setEditValues({ ...editValues, invoice_limit: e.target.value })
                            }
                          />
                        ) : (
                          <span>{fmtLimit(plan.invoice_limit)}</span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {plan.trial_days || "—"}
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            plan.is_active
                              ? "bg-green-100 text-green-700"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {plan.is_active ? "פעיל" : "לא פעיל"}
                        </span>
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <div className="flex flex-col gap-2">
                            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <input
                                type="checkbox"
                                checked={applyToExisting}
                                onChange={(e) => setApplyToExisting(e.target.checked)}
                              />
                              החל על ותיקים
                            </label>
                            <div className="flex gap-1">
                              <button
                                onClick={saveEdit}
                                disabled={updatePlan.isPending}
                                className="flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-[11px] font-medium text-white hover:bg-accent/90 disabled:opacity-50"
                              >
                                <Check size={12} /> שמור
                              </button>
                              <button
                                onClick={() => setEditId(null)}
                                className="rounded-md bg-secondary px-2 py-1 text-[11px] text-muted-foreground hover:bg-secondary/80"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(plan)}
                            className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
                          >
                            <Edit2 size={12} /> ערוך
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

      {/* History */}
      {showHistory && (
        <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
          <div className="border-b border-border px-5 py-3">
            <h3 className="text-base font-bold text-primary">היסטוריית שינויי מחיר</h3>
          </div>
          <div className="w-full overflow-hidden">
            <table className="w-full text-xs" style={{ tableLayout: "fixed" }}>
              <thead>
                <tr className="border-b border-border bg-secondary text-right text-xs font-semibold text-muted-foreground">
                  {["חבילה", "מחיר חודשי", "מחיר שנתי", "הוחל על ותיקים", "תאריך"].map((h) => (
                    <th key={h} className="p-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      אין היסטוריה
                    </td>
                  </tr>
                ) : (
                  history.map((h: any) => (
                    <tr key={h.id} className="border-b border-border">
                      <td className="p-3 font-medium text-primary">{h.plans?.name}</td>
                      <td className="p-3">{fmt(h.monthly_price)}</td>
                      <td className="p-3">{fmt(h.yearly_price)}</td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            h.apply_to_existing
                              ? "bg-accent/15 text-accent"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {h.apply_to_existing ? "כן" : "לא"}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {new Date(h.changed_at).toLocaleDateString("he-IL", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
