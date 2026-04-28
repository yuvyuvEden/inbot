import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import AuthCard from "@/components/auth/AuthCard";

const Login = () => {
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const { session } = useAuth();
  const navigate = useNavigate();

  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpConfirm, setSignUpConfirm] = useState("");

  useEffect(() => {
    if (session) navigate("/", { replace: true });
  }, [session, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError(null);
    setSuccess(null);
    const email = signInEmail.trim();
    if (!email || !signInPassword) {
      setError("יש למלא את כל השדות.");
      setFormLoading(false);
      return;
    }
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password: signInPassword });
    if (authError) {
      console.error("Login error:", authError.message, authError);
      if (authError.message.includes("Invalid login")) setError("אימייל או סיסמה שגויים.");
      else if (authError.message.includes("Email not confirmed")) setError("יש לאמת את כתובת האימייל לפני ההתחברות.");
      else if (authError.message.includes("Email logins are disabled")) setError("התחברות באימייל לא מופעלת. פנה למנהל.");
      else setError("שגיאה בהתחברות. נסה שוב.");
      setFormLoading(false);
      return;
    }
    console.log("Login successful, session:", data.session);
    setFormLoading(false);
  };

  const handleSignUpStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError(null);
    setSuccess(null);
    const email = signUpEmail.trim();
    if (!email || !signUpPassword || !signUpConfirm) {
      setError("יש למלא את כל השדות.");
      setFormLoading(false);
      return;
    }
    if (signUpPassword.length < 6) {
      setError("הסיסמה חייבת להכיל לפחות 6 תווים.");
      setFormLoading(false);
      return;
    }
    if (signUpPassword !== signUpConfirm) {
      setError("הסיסמאות אינן תואמות.");
      setFormLoading(false);
      return;
    }
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password: signUpPassword,
      options: { emailRedirectTo: window.location.origin + "/dashboard" },
    });
    if (authError) {
      if (authError.message.includes("already registered")) setError("כתובת אימייל זו כבר רשומה.");
      else setError("שגיאה בהרשמה. נסה שוב.");
      setFormLoading(false);
      return;
    }
    setFormLoading(false);
    navigate("/register", { state: { userId: data.user?.id }, replace: false });
  };

  const isLoading = formLoading;

  return (
    <AuthCard>
      {/* Tabs */}
      <div className="mb-5 flex rounded-[10px] bg-secondary p-1">
        <button
          onClick={() => { setActiveTab("signin"); setError(null); setSuccess(null); }}
          className={`flex-1 rounded-lg py-2 text-[14px] font-medium transition-colors ${
            activeTab === "signin"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          התחבר
        </button>
        <button
          onClick={() => { setActiveTab("signup"); setError(null); setSuccess(null); }}
          className={`flex-1 rounded-lg py-2 text-[14px] font-medium transition-colors ${
            activeTab === "signup"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          הרשמה
        </button>
      </div>

      {/* Sign In Form */}
      {activeTab === "signin" && (
        <form onSubmit={handleSignIn} className="space-y-4">
          <div className="space-y-1.5 text-right">
            <label className="text-[13px] font-medium text-muted-foreground">אימייל</label>
            <Input
              type="email"
              placeholder="your@email.com"
              dir="ltr"
              className="h-[44px] rounded-lg border-border text-right focus-visible:ring-primary"
              value={signInEmail}
              onChange={(e) => setSignInEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-1.5 text-right">
            <label className="text-[13px] font-medium text-muted-foreground">סיסמה</label>
            <Input
              type="password"
              placeholder="••••••••"
              dir="ltr"
              className="h-[44px] rounded-lg border-border text-right focus-visible:ring-primary"
              value={signInPassword}
              onChange={(e) => setSignInPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="text-right">
            <Link
              to="/forgot-password"
              className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              שכחתי סיסמה
            </Link>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="h-[44px] w-full rounded-lg bg-primary text-[14px] font-bold text-primary-foreground transition-colors hover:bg-primary/85 disabled:opacity-50"
          >
            {formLoading ? "מתחבר..." : "התחבר"}
          </button>
        </form>
      )}

      {/* Sign Up Form (Step 1) */}
      {activeTab === "signup" && (
        <form onSubmit={handleSignUpStep1} className="space-y-4">
          <div className="space-y-1.5 text-right">
            <label className="text-[13px] font-medium text-muted-foreground">אימייל</label>
            <Input
              type="email"
              placeholder="your@email.com"
              dir="ltr"
              className="h-[44px] rounded-lg border-border text-right focus-visible:ring-primary"
              value={signUpEmail}
              onChange={(e) => setSignUpEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-1.5 text-right">
            <label className="text-[13px] font-medium text-muted-foreground">סיסמה</label>
            <Input
              type="password"
              placeholder="לפחות 6 תווים"
              dir="ltr"
              className="h-[44px] rounded-lg border-border text-right focus-visible:ring-primary"
              value={signUpPassword}
              onChange={(e) => setSignUpPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-1.5 text-right">
            <label className="text-[13px] font-medium text-muted-foreground">אימות סיסמה</label>
            <Input
              type="password"
              placeholder="הזן סיסמה שוב"
              dir="ltr"
              className="h-[44px] rounded-lg border-border text-right focus-visible:ring-primary"
              value={signUpConfirm}
              onChange={(e) => setSignUpConfirm(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="h-[44px] w-full rounded-lg bg-primary text-[14px] font-bold text-primary-foreground transition-colors hover:bg-primary/85 disabled:opacity-50"
          >
            {formLoading ? "יוצר חשבון..." : "המשך לפרטי עסק ←"}
          </button>
        </form>
      )}

      {/* Messages */}
      {error && <p className="mt-4 text-center text-[13px] text-destructive">{error}</p>}
      {success && <p className="mt-4 text-center text-[13px] text-accent">{success}</p>}
    </AuthCard>
  );
};

export default Login;
