import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import AuthCard from "@/components/auth/AuthCard";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError("יש להזין כתובת אימייל.");
      setLoading(false);
      return;
    }
    const { error: authError } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: window.location.origin + "/reset-password",
    });
    if (authError) {
      setError("שגיאה בשליחת הקישור. נסה שוב.");
      setLoading(false);
      return;
    }
    setSuccess(true);
    setLoading(false);
  };

  return (
    <AuthCard>
      <h1 className="mb-2 text-center text-[20px] font-bold text-primary">איפוס סיסמה</h1>
      <p className="mb-6 text-center text-[14px] text-muted-foreground">
        הזן את האימייל שלך ונשלח לך קישור לאיפוס
      </p>

      {success ? (
        <p className="text-center text-[14px] font-medium" style={{ color: "#16a34a" }}>
          קישור נשלח! בדוק את תיבת המייל שלך
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <button
            type="submit"
            disabled={loading}
            className="h-[44px] w-full rounded-lg bg-primary text-[14px] font-bold text-primary-foreground transition-colors hover:bg-primary/85 disabled:opacity-50"
          >
            {loading ? "שולח..." : "שלח קישור לאיפוס"}
          </button>
        </form>
      )}

      {error && <p className="mt-4 text-center text-[13px] text-destructive">{error}</p>}

      <div className="mt-6 text-center">
        <Link to="/login" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors">
          ← חזור להתחברות
        </Link>
      </div>
    </AuthCard>
  );
};

export default ForgotPassword;
