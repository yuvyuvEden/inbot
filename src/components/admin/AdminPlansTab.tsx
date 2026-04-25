import { useState, useEffect } from "react";
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

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

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

        {isMobile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "12px" }}>
            {isLoading ? (
              <div style={{ padding: "24px", textAlign: "center", color: "#94a3b8", fontFamily: "Heebo, sans-serif" }}>טוען...</div>
            ) : (
              plans.map((plan: any) => (
                <div key={plan.id} style={{ background: "#ffffff", borderRadius: "12px", padding: "16px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", fontFamily: "Heebo, sans-serif" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", gap: "8px" }}>
                    <span style={{ fontWeight: 700, fontSize: "16px", color: "#1e3a5f" }}>{plan.name}</span>
                    <span style={{ background: plan.is_active ? "#dcfce7" : "#f1f5f9", color: plan.is_active ? "#16a34a" : "#64748b", borderRadius: "20px", padding: "2px 10px", fontSize: "12px", fontWeight: 600 }}>
                      {plan.is_active ? "פעיל" : "לא פעיל"}
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px", fontSize: "13px", color: "#1a202c" }}>
                    <div><span style={{ color: "#64748b" }}>חודשי: </span><strong>{fmt(plan.monthly_price)}</strong></div>
                    <div><span style={{ color: "#64748b" }}>שנתי: </span><strong>{fmt(plan.yearly_price)}</strong></div>
                    <div><span style={{ color: "#64748b" }}>משתמשים: </span><strong>{fmtLimit(plan.user_limit)}</strong></div>
                    <div><span style={{ color: "#64748b" }}>חשבוניות: </span><strong>{fmtLimit(plan.invoice_limit)}</strong></div>
                  </div>
                  <button
                    onClick={() => startEdit(plan)}
                    style={{
                      width: "100%", padding: "8px", borderRadius: "8px",
                      backgroundColor: "#1e3a5f", color: "#ffffff", border: "none",
                      cursor: "pointer", fontSize: "13px", fontFamily: "Heebo, sans-serif", fontWeight: 600,
                    }}
                  >
                    ✏️ ערוך
                  </button>
                </div>
              ))
            )}

            {isMobile && editId && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.5)",
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  zIndex: 9999,
                }}
                onClick={() => setEditId(null)}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{ background: "#ffffff", borderRadius: "16px 16px 0 0", padding: "24px", width: "100%", fontFamily: "Heebo, sans-serif", maxHeight: "85vh", overflowY: "auto" }}
                >
                  <h3 style={{ margin: "0 0 16px 0", color: "#1e3a5f" }}>
                    עריכת {plans.find((p: any) => p.id === editId)?.name}
                  </h3>
                  {[
                    { label: "מחיר חודשי", key: "monthly_price" },
                    { label: "מחיר שנתי", key: "yearly_price" },
                    { label: "משתמשים", key: "user_limit" },
                    { label: "חשבוניות/חודש", key: "invoice_limit" },
                  ].map(({ label, key }) => (
                    <label key={key} style={{ display: "block", marginBottom: "12px" }}>
                      <span style={{ fontSize: "13px", color: "#64748b" }}>{label}</span>
                      <input
                        type="number"
                        value={(editValues as any)[key]}
                        onChange={(e) => setEditValues({ ...editValues, [key]: e.target.value })}
                        style={{ display: "block", width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "14px", fontFamily: "Heebo, sans-serif", boxSizing: "border-box", marginTop: "4px" }}
                      />
                    </label>
                  ))}
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", fontSize: "13px" }}>
                    <input type="checkbox" checked={applyToExisting} onChange={(e) => setApplyToExisting(e.target.checked)} />
                    החל על לקוחות ותיקים
                  </label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={saveEdit}
                      disabled={updatePlan.isPending}
                      style={{ flex: 1, padding: "12px", borderRadius: "8px", backgroundColor: "#1e3a5f", color: "#ffffff", border: "none", cursor: "pointer", fontSize: "14px", fontFamily: "Heebo, sans-serif", fontWeight: 600 }}
                    >
                      שמור
                    </button>
                    <button
                      onClick={() => setEditId(null)}
                      style={{ padding: "12px 20px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#ffffff", color: "#64748b", cursor: "pointer", fontSize: "14px", fontFamily: "Heebo, sans-serif" }}
                    >
                      ביטול
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", width: "100%" }}>
          <table className="w-full text-xs" style={{ tableLayout: "fixed", minWidth: isMobile ? "600px" : undefined }}>
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
        )}
      </div>

      {/* History */}
      {showHistory && (
        <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
          <div className="border-b border-border px-5 py-3">
            <h3 className="text-base font-bold text-primary">היסטוריית שינויי מחיר</h3>
          </div>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", width: "100%" }}>
            <table className="w-full text-xs" style={{ tableLayout: "fixed", minWidth: isMobile ? "600px" : undefined }}>
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
