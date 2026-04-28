import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Check, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import AuthCard from "@/components/auth/AuthCard";

type Step = 1 | 2 | 3;

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
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  // Step 2
  const [brandName, setBrandName] = useState("");
  const [legalName, setLegalName] = useState("");

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed || !password || !confirm) {
      setError("יש למלא את כל השדות.");
      return;
    }
    if (password.length < 6) {
      setError("הסיסמה חייבת להכיל לפחות 6 תווים.");
      return;
    }
    if (password !== confirm) {
      setError("הסיסמאות אינן תואמות.");
      return;
    }
    setLoading(true);
    const { data, error: authError } = await supabase.auth.signUp({
      email: trimmed,
      password,
      options: { emailRedirectTo: window.location.origin + "/dashboard" },
    });
    setLoading(false);
    if (authError) {
      if (authError.message.includes("already registered"))
        setError("כתובת אימייל זו כבר רשומה.");
      else setError("שגיאה בהרשמה. נסה שוב.");
      return;
    }
    if (!data.user?.id) {
      setError("שגיאה ביצירת המשתמש. נסה שוב.");
      return;
    }
    setUserId(data.user.id);
    setStep(2);
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!brandName.trim()) {
      setError("יש להזין שם עסק.");
      return;
    }
    if (!userId) {
      setError("שגיאה: לא נמצא משתמש. חזור לשלב הקודם.");
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
    setStep(3);
  };

  return (
    <AuthCard>
      <StepIndicator step={step} />

      {step === 1 && (
        <form onSubmit={handleStep1} className="space-y-4" dir="rtl">
          <h2 className="text-right text-[16px] font-bold text-foreground">פרטי חשבון</h2>
          <div className="space-y-1.5 text-right">
            <label className="text-[13px] font-medium text-muted-foreground">אימייל</label>
            <Input
              type="email"
              placeholder="your@email.com"
              dir="ltr"
              className="h-[44px] rounded-lg border-border text-right focus-visible:ring-primary"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5 text-right">
            <label className="text-[13px] font-medium text-muted-foreground">סיסמה</label>
            <Input
              type="password"
              placeholder="לפחות 6 תווים"
              dir="ltr"
              className="h-[44px] rounded-lg border-border text-right focus-visible:ring-primary"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5 text-right">
            <label className="text-[13px] font-medium text-muted-foreground">אימות סיסמה</label>
            <Input
              type="password"
              placeholder="הזן סיסמה שוב"
              dir="ltr"
              className="h-[44px] rounded-lg border-border text-right focus-visible:ring-primary"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="h-[44px] w-full rounded-lg bg-primary text-[14px] font-bold text-primary-foreground transition-colors hover:bg-primary/85 disabled:opacity-50"
          >
            {loading ? "יוצר חשבון..." : "המשך →"}
          </button>
          {error && <p className="text-center text-[13px] text-destructive">{error}</p>}
          <p className="text-center text-[12px] text-muted-foreground">
            כבר יש לך חשבון?{" "}
            <Link to="/login" className="text-primary hover:underline">
              התחבר
            </Link>
          </p>
        </form>
      )}

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
          <button
            type="submit"
            disabled={loading}
            className="h-[44px] w-full rounded-lg bg-primary text-[14px] font-bold text-primary-foreground transition-colors hover:bg-primary/85 disabled:opacity-50"
          >
            {loading ? "שומר..." : "סיום הרשמה →"}
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
