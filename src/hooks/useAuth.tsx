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
  signOut: () => Promise<{ error: Error | null }>;
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
  const authHydratedRef = useRef(false);

  useEffect(() => {
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;

      const nextUser = nextSession?.user ?? null;
      const nextUserId = nextUser?.id ?? null;
      const sameUser = currentUserIdRef.current === nextUserId;

      // Durante a hidratação inicial, ignore sessões transitórias nulas
      if (!authHydratedRef.current) {
        if (event === "INITIAL_SESSION") return;
        if (!nextSession && currentUserIdRef.current) return;
      }

      if (event === "SIGNED_OUT") {
        authHydratedRef.current = true;
        currentUserIdRef.current = null;
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      // Ao voltar para a aba, refresh/restore da mesma sessão não deve provocar recarga visual
      if (sameUser && event !== "USER_UPDATED") {
        setSession(nextSession);
        setLoading(false);
        return;
      }

      // Ignora sessões nulas transitórias enquanto a sessão válida é restaurada
      if (!nextSession && currentUserIdRef.current) {
        return;
      }

      authHydratedRef.current = true;
      currentUserIdRef.current = nextUserId;
      setSession(nextSession);
      setUser(nextUser);
      setLoading(false);
    });

    // Timeout de segurança: se getSession() travar (refresh_token preso,
    // storage corrompido, rede offline sem evento), liberamos a UI como
    // "sem sessão" para o usuário poder navegar / refazer login em vez
    // de ficar preso em "Carregando..." para sempre.
    const safetyTimer = window.setTimeout(() => {
      if (!active || authHydratedRef.current) return;
      console.warn("[useAuth] getSession timeout — liberando UI sem sessão");
      authHydratedRef.current = true;
      currentUserIdRef.current = null;
      setSession(null);
      setUser(null);
      setLoading(false);
    }, 8000);

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!active) return;
        window.clearTimeout(safetyTimer);

        authHydratedRef.current = true;
        currentUserIdRef.current = session?.user?.id ?? null;
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        window.clearTimeout(safetyTimer);

        authHydratedRef.current = true;
        currentUserIdRef.current = null;
        setSession(null);
        setUser(null);
        setLoading(false);
      });

    return () => {
      active = false;
      window.clearTimeout(safetyTimer);
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
