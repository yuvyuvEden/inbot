import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import AuthCard from "@/components/auth/AuthCard";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setHasSession(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!password || !confirm) {
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
    const { error: authError } = await supabase.auth.updateUser({ password });
    if (authError) {
      setError("שגיאה בעדכון הסיסמה. נסה שוב.");
      setLoading(false);
      return;
    }
    setSuccess(true);
    setLoading(false);
    setTimeout(() => navigate("/login", { replace: true }), 2000);
  };

  if (hasSession === null) {
    return (
      <AuthCard>
        <p className="text-center text-muted-foreground">טוען...</p>
      </AuthCard>
    );
  }

  if (!hasSession) {
    return (
      <AuthCard>
        <p className="text-center text-destructive text-[14px]">
          אין הרשאה לאיפוס סיסמה. נסה לבקש קישור חדש.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <h1 className="mb-6 text-center text-[20px] font-bold text-primary">סיסמה חדשה</h1>

      {success ? (
        <p className="text-center text-[14px] font-medium" style={{ color: "#16a34a" }}>
          הסיסמה עודכנה בהצלחה! 🎉
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5 text-right">
            <label className="text-[13px] font-medium text-muted-foreground">סיסמה חדשה</label>
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
            {loading ? "מעדכן..." : "עדכן סיסמה"}
          </button>
        </form>
      )}

      {error && <p className="mt-4 text-center text-[13px] text-destructive">{error}</p>}
    </AuthCard>
  );
};

export default ResetPassword;
