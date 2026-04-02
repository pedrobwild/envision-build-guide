import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: () => supabase.auth.signOut(),
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;

      currentUserIdRef.current = session?.user?.id ?? null;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;

      const nextUser = nextSession?.user ?? null;
      const nextUserId = nextUser?.id ?? null;
      const sameUser = currentUserIdRef.current === nextUserId;

      // Ignore token refreshes for the same user (tab focus)
      if (event === "TOKEN_REFRESHED" && sameUser) {
        setSession(nextSession);
        setLoading(false);
        return;
      }

      // Keep same user reference when identity hasn't changed
      if (sameUser && event !== "SIGNED_OUT" && event !== "USER_UPDATED") {
        setSession(nextSession);
        setLoading(false);
        return;
      }

      // Only clear user on explicit sign-out; otherwise keep current user
      if (event === "SIGNED_OUT") {
        currentUserIdRef.current = null;
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      currentUserIdRef.current = nextUserId;
      setSession(nextSession);
      setUser(nextUser);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(() => supabase.auth.signOut(), []);

  const value = useMemo(
    () => ({ user, session, loading, signOut }),
    [user, session, loading, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
