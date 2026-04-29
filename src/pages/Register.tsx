import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Check, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import AuthCard from "@/components/auth/AuthCard";

type Step = 2 | 3;

const StepIndicator = ({ step }: { step: Step }) => {
  const items = [
    { n: 1, label: "פרטי חשבון" },
    { n: 2, label: "פרטי עסק" },
    { n: 3, label: "סיום" },
  ];
  return (
    <div className="mb-6 flex items-center justify-between" dir="rtl">
      {items.map((it, idx) => {
        const done = step > it.n;
        const active = step === it.n;
        return (
          <div key={it.n} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold transition-colors ${
                  done
                    ? "bg-accent text-accent-foreground"
                    : active
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-muted-foreground"
                }`}
              >
                {done ? <Check size={16} /> : it.n}
              </div>
              <span
                className={`mt-1 text-[11px] ${
                  active ? "font-medium text-foreground" : "text-muted-foreground"
                }`}
              >
                {it.label}
              </span>
            </div>
            {idx < items.length - 1 && (
              <div
                className={`mx-2 mb-5 h-px flex-1 ${
                  step > it.n ? "bg-accent" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

const Register = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const userId = (location.state as { userId?: string } | null)?.userId;

  const [step, setStep] = useState<Step>(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [brandName, setBrandName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [phone, setPhone] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      navigate("/login", { replace: true });
    }
  }, [userId, navigate]);

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!brandName.trim()) {
      setError("יש להזין שם עסק.");
      return;
    }
    if (!userId) {
      setError("שגיאה: לא נמצא משתמש. חזור להתחברות.");
      return;
    }
    setLoading(true);
    const { error: insertError } = await supabase.from("clients").insert({
      brand_name: brandName.trim(),
      legal_name: legalName.trim() || null,
      user_id: userId,
      is_active: true,
    });
    setLoading(false);
    if (insertError) {
      setError("שגיאה בשמירת פרטי העסק. נסה שוב.");
      return;
    }
    // שמור טלפון בפרופיל
    if (phone.trim()) {
      await supabase
        .from("profiles")
        .update({ phone: phone.trim() })
        .eq("user_id", userId);
    }
    // הוסף את הבעלים ל-client_users
    const { data: newClient } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (newClient) {
      await supabase.from("client_users").insert({
        client_id: newClient.id,
        user_id: userId,
        role: "owner",
      }).then(() => {});
    }
    setStep(3);
  };

  if (!userId) return null;

  return (
    <AuthCard>
      <StepIndicator step={step} />

      {step === 2 && (
        <form onSubmit={handleStep2} className="space-y-4" dir="rtl">
          <h2 className="text-right text-[16px] font-bold text-foreground">פרטי עסק</h2>
          <div className="space-y-1.5 text-right">
            <label className="text-[13px] font-medium text-muted-foreground">
              שם העסק <span className="text-destructive">*</span>
            </label>
            <Input
              type="text"
              placeholder="למשל: עדן טק בע״מ"
              className="h-[44px] rounded-lg border-border text-right focus-visible:ring-primary"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5 text-right">
            <label className="text-[13px] font-medium text-muted-foreground">שם משפטי</label>
            <Input
              type="text"
              placeholder="אם שונה משם העסק"
              className="h-[44px] rounded-lg border-border text-right focus-visible:ring-primary"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5 text-right">
            <label className="text-[13px] font-medium text-muted-foreground">
              טלפון <span style={{ fontSize: 11, color: "#94a3b8" }}>(לתמיכה)</span>
            </label>
            <Input
              type="tel"
              placeholder="050-0000000"
              className="h-[44px] rounded-lg border-border text-right focus-visible:ring-primary"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
              dir="ltr"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="h-[44px] w-full rounded-lg bg-primary text-[14px] font-bold text-primary-foreground transition-colors hover:bg-primary/85 disabled:opacity-50"
          >
            {loading ? "שומר..." : "סיום הרשמה ←"}
          </button>
          {error && <p className="text-center text-[13px] text-destructive">{error}</p>}
        </form>
      )}

      {step === 3 && (
        <div className="space-y-4 text-center" dir="rtl">
          <div className="flex justify-center">
            <CheckCircle2 size={48} color="#16a34a" />
          </div>
          <h2 className="text-[18px] font-bold text-foreground">ברוך הבא ל-INBOT! 🎉</h2>
          <p className="text-[14px] text-muted-foreground">החשבון שלך נוצר בהצלחה.</p>
          <p className="text-[13px] text-muted-foreground">
            שלחנו אימות לכתובת האימייל שלך. ניתן להתחיל להשתמש במערכת כבר עכשיו.
          </p>
          {(() => {
            const trialEnd = new Date();
            trialEnd.setDate(trialEnd.getDate() + 30);
            const formatted = trialEnd.toLocaleDateString("he-IL", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            });
            return (
              <div
                style={{
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: 8,
                  padding: "12px 16px",
                  marginTop: 16,
                }}
                className="text-right"
                dir="rtl"
              >
                <div style={{ fontSize: 14 }}>
                  🎉{" "}
                  <span style={{ fontWeight: 700, color: "#1e3a5f" }}>
                    תקופת ניסיון של 30 יום
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  הגישה שלך פעילה עד: {formatted}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  במהלך הניסיון תוכל לעבד עד 30 חשבוניות.
                </div>
              </div>
            );
          })()}
          {/* קוד הזמנה — אם הוזמן על ידי מישהו */}
          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 16, marginTop: 8 }}>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8, textAlign: "right" }}>
              קיבלת קוד הזמנה מחשבון קיים? הכנס אותו כאן:
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                placeholder="XXXXXX"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value.toUpperCase())}
                maxLength={6}
                style={{
                  flex: 1, border: "1px solid #e2e8f0", borderRadius: 8,
                  padding: "8px 12px", fontFamily: "monospace", fontSize: 16,
                  textAlign: "center", letterSpacing: 4, direction: "ltr",
                  outline: "none",
                }}
              />
              <button
                disabled={inviteLoading || inviteCode.length < 6}
                onClick={async () => {
                  if (!inviteCode.trim()) return;
                  setInviteLoading(true);
                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    const res = await fetch(
                      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accept-invite`,
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          "Authorization": `Bearer ${session?.access_token}`,
                        },
                        body: JSON.stringify({ invite_code: inviteCode }),
                      }
                    );
                    const data = await res.json();
                    if (!res.ok) {
                      alert(data.error || "שגיאה בהצטרפות");
                    } else {
                      alert(`✅ הצטרפת בהצלחה לחשבון: ${data.brand_name}`);
                      setInviteCode("");
                    }
                  } finally {
                    setInviteLoading(false);
                  }
                }}
                style={{
                  padding: "8px 16px", borderRadius: 8, border: "none",
                  backgroundColor: inviteCode.length === 6 ? "#1e3a5f" : "#e2e8f0",
                  color: inviteCode.length === 6 ? "#fff" : "#94a3b8",
                  fontFamily: "Heebo, sans-serif", fontSize: 13, fontWeight: 700,
                  cursor: inviteCode.length === 6 ? "pointer" : "default",
                  whiteSpace: "nowrap",
                }}
              >
                {inviteLoading ? "מצרף..." : "הצטרף"}
              </button>
            </div>
          </div>
          <button
            onClick={() => navigate("/dashboard", { replace: true })}
            className="h-[44px] w-full rounded-lg bg-primary text-[14px] font-bold text-primary-foreground transition-colors hover:bg-primary/85"
          >
            כניסה לדשבורד ←
          </button>
        </div>
      )}
    </AuthCard>
  );
};

export default Register;
