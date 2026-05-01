import { useState } from "react";
import { usePlans } from "@/hooks/usePlans";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, ArrowUpCircle } from "lucide-react";

interface Props {
  client: any;
  onClose: () => void;
  onSaved: () => void;
}

export function ChangePlanModal({ client, onClose, onSaved }: Props) {
  const { data: plans = [] } = usePlans();
  const [selectedPlanId, setSelectedPlanId] = useState<string>(client.plan_id ?? "");
  const [keepLockedPrice, setKeepLockedPrice] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedPlan = plans.find((p: any) => p.id === selectedPlanId);

  const save = async () => {
    if (!selectedPlanId) return;
    setSaving(true);
    try {
      const updates: any = {
        plan_id: selectedPlanId,
        plan_type: selectedPlan?.name ?? client.plan_type,
      };

      // אם לא שומרים מחיר נעול — עדכן למחיר החבילה החדשה
      if (!keepLockedPrice) {
        updates.locked_monthly_price = Number(selectedPlan?.monthly_price ?? 0);
        updates.locked_yearly_price = Number(selectedPlan?.yearly_price ?? 0);
      }

      const { error } = await supabase
        .from("clients")
        .update(updates)
        .eq("id", client.id);

      if (error) throw error;
      toast.success(`החבילה שונתה ל-${selectedPlan?.name}`);
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n: number) => (Number(n) === 0 ? "חינם" : `₪${n}`);
  const fmtLimit = (n: number) => (Number(n) === 0 ? "∞" : String(n));

  return (
    <div
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "Heebo, sans-serif",
      }}
      dir="rtl"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: "12px", width: "min(560px, 92vw)",
          maxHeight: "90vh", overflowY: "auto", padding: "24px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <ArrowUpCircle size={20} style={{ color: "#e8941a" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#1e3a5f", margin: 0 }}>
              שינוי חבילה — {client.brand_name}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
            aria-label="סגור"
          >
            <X size={20} />
          </button>
        </div>

        {/* חבילה נוכחית */}
        <div style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: "8px", marginBottom: "16px", fontSize: "13px", color: "#1a202c" }}>
          <span style={{ color: "#64748b" }}>חבילה נוכחית: </span>
          <strong>{client.plans?.name ?? client.plan_type ?? "—"}</strong>
          {client.locked_monthly_price != null && (
            <span style={{ color: "#64748b", marginRight: "6px" }}>
              (מחיר נעול: {fmt(client.locked_monthly_price)}/חודש)
            </span>
          )}
        </div>

        {/* בחירת חבילה */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e3a5f", marginBottom: "8px" }}>
            בחר חבילה חדשה:
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {plans.filter((p: any) => p.is_active).map((plan: any) => (
              <label
                key={plan.id}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 12px", border: `1px solid ${selectedPlanId === plan.id ? "#e8941a" : "#e2e8f0"}`,
                  borderRadius: "8px", cursor: "pointer",
                  background: selectedPlanId === plan.id ? "#fff7ed" : "#fff",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <input
                    type="radio"
                    name="plan"
                    checked={selectedPlanId === plan.id}
                    onChange={() => setSelectedPlanId(plan.id)}
                    style={{ accentColor: "#e8941a" }}
                  />
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "#1a202c" }}>{plan.name}</div>
                    <div style={{ fontSize: "11px", color: "#64748b" }}>
                      {fmtLimit(plan.user_limit)} משתמשים • {fmtLimit(plan.invoice_limit)} חשבוניות/חודש
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#1e3a5f" }}>
                  {fmt(plan.monthly_price)}/חודש
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* שמור מחיר נעול */}
        {client.locked_monthly_price != null && (
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#1a202c", marginBottom: "12px" }}>
            <input
              type="checkbox"
              checked={keepLockedPrice}
              onChange={(e) => setKeepLockedPrice(e.target.checked)}
              style={{ accentColor: "#e8941a" }}
            />
            שמור מחיר נעול קיים (₪{client.locked_monthly_price ?? 0}/חודש)
          </label>
        )}

        {/* אזהרה אם מוריד חבילה */}
        {selectedPlan && client.plans &&
          selectedPlan.invoice_limit > 0 &&
          selectedPlan.invoice_limit < (client.plans.invoice_limit ?? 0) && (
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", padding: "8px 12px", borderRadius: "8px", fontSize: "12px", marginBottom: "12px" }}>
              ⚠️ הורדת חבילה — מגבלת החשבוניות תרד מ-{client.plans.invoice_limit} ל-{selectedPlan.invoice_limit}
            </div>
          )}

        {/* Actions */}
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "8px" }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px", borderRadius: "8px", fontSize: "13px",
              background: "#f1f5f9", color: "#1a202c", border: "none", cursor: "pointer",
              fontFamily: "Heebo, sans-serif",
            }}
          >
            ביטול
          </button>
          <button
            onClick={save}
            disabled={saving || !selectedPlanId}
            style={{
              padding: "8px 16px", borderRadius: "8px", fontSize: "13px",
              background: "#e8941a", color: "#fff", border: "none",
              cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1,
              fontWeight: 600, fontFamily: "Heebo, sans-serif",
            }}
          >
            {saving ? "שומר..." : "שנה חבילה"}
          </button>
        </div>
      </div>
    </div>
  );
}
