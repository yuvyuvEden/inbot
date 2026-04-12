import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import AuthCard from "@/components/auth/AuthCard";

const Login = () => {
  const [googleLoading, setGoogleLoading] = useState(false);
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

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    setSuccess(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError("שגיאה בהתחברות עם Google. נסה שוב.");
      setGoogleLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate("/", { replace: true });
  };

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
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password: signInPassword });
    if (authError) {
      if (authError.message.includes("Invalid login")) setError("אימייל או סיסמה שגויים.");
      else if (authError.message.includes("Email not confirmed")) setError("יש לאמת את כתובת האימייל לפני ההתחברות.");
      else setError("שגיאה בהתחברות. נסה שוב.");
      setFormLoading(false);
      return;
    }
    setFormLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
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
    const { error: authError } = await supabase.auth.signUp({
      email,
      password: signUpPassword,
      options: { emailRedirectTo: window.location.origin },
    });
    if (authError) {
      if (authError.message.includes("already registered")) setError("כתובת אימייל זו כבר רשומה.");
      else setError("שגיאה בהרשמה. נסה שוב.");
      setFormLoading(false);
      return;
    }
    setSuccess("ההרשמה בוצעה בהצלחה! בדוק את תיבת האימייל לאימות החשבון.");
    setSignUpEmail("");
    setSignUpPassword("");
    setSignUpConfirm("");
    setFormLoading(false);
  };

  const isLoading = formLoading || googleLoading;

  return (
    <AuthCard>
      {/* Google Button */}
      <button
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className="flex h-[44px] w-full items-center justify-center gap-3 rounded-lg border border-border bg-card text-[14px] font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        {googleLoading ? "מתחבר..." : "התחבר עם Google"}
      </button>

      {/* Divider */}
      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[13px] text-muted-foreground">או</span>
        <div className="h-px flex-1 bg-border" />
      </div>

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

      {/* Sign Up Form */}
      {activeTab === "signup" && (
        <form onSubmit={handleSignUp} className="space-y-4">
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
            {formLoading ? "נרשם..." : "הירשם"}
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
