import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  roleLoading: boolean;
  userRole: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  const fetchRole = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      setUserRole(data ? String(data.role) : null);
    } catch {
      setUserRole(null);
    } finally {
      setRoleLoading(false);
    }
  };

  useEffect(() => {
    // Safety timeouts
    const loadingTimer = setTimeout(() => setLoading(false), 5000);
    const roleTimer = setTimeout(() => setRoleLoading(false), 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setLoading(false);
        if (session?.user) {
          fetchRole(session.user.id);
        } else {
          setUserRole(null);
          setRoleLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
      clearTimeout(loadingTimer);
      clearTimeout(roleTimer);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserRole(null);
    setRoleLoading(false);
  };

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      loading,
      roleLoading,
      userRole,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
