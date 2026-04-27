import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { AlertTriangle, Phone, Mail } from "lucide-react";

interface Props {
  clientId: string;
  brandName: string;
}

const PLANS = [
  { key: "basic", label: "Basic", description: "עד 50 חשבוניות בחודש" },
  { key: "pro", label: "Pro", description: "חשבוניות ללא הגבלה + AI Chat" },
];

export function GracePeriodModal({ clientId, brandName }: Props) {
  const { signOut } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!selectedPlan) {
      toast.error("יש לבחור חבילה");
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("clients")
      .update({ plan_type: selectedPlan })
      .eq("id", clientId);
    setLoading(false);
    if (error) {
      toast.error("שגיאה בשמירת הבחירה");
      return;
    }
    setSubmitted(true);
  };

  return (
    <div
      dir="rtl"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        fontFamily: "Heebo, sans-serif",
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "14px",
          maxWidth: "520px",
          width: "100%",
          padding: "28px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
          borderTop: "5px solid #e8941a",
        }}
      >
        {!submitted ? (
          <>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <AlertTriangle size={26} color="#e8941a" />
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#1e3a5f" }}>
                נדרש מנוי פעיל להמשך שימוש
              </h2>
            </div>

            <p style={{ margin: "0 0 20px 0", color: "#475569", fontSize: "14px", lineHeight: 1.7 }}>
              שלום {brandName},
              <br />
              רואה החשבון שלך הסיר אותך ממנויו. על מנת להמשיך להשתמש ב-INBOT,
              יש לבחור חבילה מתאימה ולצור איתנו קשר לאישור התשלום.
            </p>

            {/* Plan selection */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
              {PLANS.map((plan) => (
                <button
                  key={plan.key}
                  onClick={() => setSelectedPlan(plan.key)}
                  style={{
                    padding: "14px 16px",
                    borderRadius: "10px",
                    textAlign: "right",
                    border: selectedPlan === plan.key ? "2px solid #e8941a" : "2px solid #e2e8f0",
                    background: selectedPlan === plan.key ? "#fff7ed" : "#ffffff",
                    cursor: "pointer",
                    fontFamily: "Heebo, sans-serif",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ fontWeight: 700, color: "#1e3a5f", fontSize: "15px" }}>{plan.label}</div>
                  <div style={{ color: "#64748b", fontSize: "13px", marginTop: "2px" }}>{plan.description}</div>
                </button>
              ))}
            </div>

            {/* Contact info */}
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "14px 16px",
                marginBottom: "20px",
              }}
            >
              <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#1e3a5f", fontWeight: 700 }}>
                לאחר הבחירה נציג יצור איתך קשר:
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#475569", marginBottom: "4px" }}>
                <Mail size={14} color="#1e3a5f" /> support@inbot.co.il
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#475569" }}>
                <Phone size={14} color="#1e3a5f" /> 03-000-0000
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={signOut}
                style={{
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#475569",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontFamily: "Heebo, sans-serif",
                }}
              >
                התנתק
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#e8941a",
                  color: "#ffffff",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  fontWeight: 700,
                  opacity: loading ? 0.7 : 1,
                  fontFamily: "Heebo, sans-serif",
                }}
              >
                {loading ? "שומר..." : "בחר חבילה ושלח בקשה"}
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div style={{ fontSize: "44px", marginBottom: "12px" }}>✅</div>
            <h2 style={{ margin: "0 0 12px 0", fontSize: "20px", fontWeight: 700, color: "#1e3a5f" }}>
              הבקשה נשלחה בהצלחה!
            </h2>
            <p style={{ margin: "0 0 20px 0", color: "#475569", fontSize: "14px", lineHeight: 1.7 }}>
              בחרת בחבילת {PLANS.find((p) => p.key === selectedPlan)?.label}.
              <br />
              נציג שלנו יצור איתך קשר בהקדם לאישור התשלום והפעלת החשבון.
            </p>
            <button
              onClick={signOut}
              style={{
                padding: "10px 22px",
                borderRadius: "8px",
                border: "none",
                background: "#1e3a5f",
                color: "#ffffff",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 700,
                fontFamily: "Heebo, sans-serif",
              }}
            >
              התנתק לעת עתה
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
