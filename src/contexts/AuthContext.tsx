import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
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

  const currentUserIdRef = useRef<string | null>(null);
  const pendingRoleUserIdRef = useRef<string | null>(null);
  const resolvedRoleUserIdRef = useRef<string | null>(null);

  const clearRoleState = () => {
    currentUserIdRef.current = null;
    pendingRoleUserIdRef.current = null;
    resolvedRoleUserIdRef.current = null;
    setUserRole(null);
    setRoleLoading(false);
  };

  const fetchRole = async (userId: string) => {
    if (resolvedRoleUserIdRef.current === userId) {
      setRoleLoading(false);
      return;
    }

    if (pendingRoleUserIdRef.current === userId) {
      return;
    }

    pendingRoleUserIdRef.current = userId;
    setRoleLoading(true);

    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (currentUserIdRef.current !== userId) {
        return;
      }

      resolvedRoleUserIdRef.current = userId;
      setUserRole(data ? String(data.role) : null);
    } catch {
      if (currentUserIdRef.current !== userId) {
        return;
      }

      resolvedRoleUserIdRef.current = null;
      setUserRole(null);
    } finally {
      if (pendingRoleUserIdRef.current === userId) {
        pendingRoleUserIdRef.current = null;
      }

      if (currentUserIdRef.current === userId) {
        setRoleLoading(false);
      }
    }
  };

  useEffect(() => {
    let isActive = true;

    const loadingTimer = window.setTimeout(() => {
      if (isActive) {
        setLoading(false);
      }
    }, 5000);

    const roleTimer = window.setTimeout(() => {
      if (isActive) {
        setRoleLoading(false);
      }
    }, 5000);

    const applySession = (nextSession: Session | null) => {
      if (!isActive) {
        return;
      }

      const previousUserId = currentUserIdRef.current;
      const nextUserId = nextSession?.user?.id ?? null;

      currentUserIdRef.current = nextUserId;
      setSession(nextSession);
      setLoading(false);

      if (!nextUserId) {
        clearRoleState();
        return;
      }

      if (nextUserId !== previousUserId) {
        pendingRoleUserIdRef.current = null;
        resolvedRoleUserIdRef.current = null;
        setUserRole(null);
      }

      void fetchRole(nextUserId);
    };

    void supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        applySession(session);
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        setLoading(false);
        setRoleLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
      window.clearTimeout(loadingTimer);
      window.clearTimeout(roleTimer);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    clearRoleState();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        roleLoading,
        userRole,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};