import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createElement } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { AppRole } from "@/lib/role-constants";

export interface UserProfile {
  id: string;
  full_name: string;
  is_active: boolean;
  roles: AppRole[];
}

interface UserProfileContextType {
  profile: UserProfile | null;
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  isAdmin: boolean;
  isComercial: boolean;
  isOrcamentista: boolean;
}

const UserProfileContext = createContext<UserProfileContextType>({
  profile: null,
  loading: true,
  hasRole: () => false,
  isAdmin: false,
  isComercial: false,
  isOrcamentista: false,
});

/**
 * Provider that fetches the current user's profile + roles ONCE
 * and shares the result across all consumers via context.
 */
export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const prevUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      prevUserId.current = null;
      return;
    }

    // If we already loaded for this same user, skip the loading flash
    const isNewUser = prevUserId.current !== user.id;
    if (isNewUser) {
      setLoading(true);
    }

    let cancelled = false;

    // Timeout de segurança: se as queries travarem (rede flaky, edge node lento),
    // liberamos a UI com um perfil mínimo em vez de prender o usuário em
    // "Verificando sessão..." para sempre. O perfil real é refetched assim
    // que `user` mudar ou a página recarregar.
    const safetyTimer = window.setTimeout(() => {
      if (cancelled) return;
      console.warn("[useUserProfile] timeout — liberando UI com perfil mínimo");
      prevUserId.current = user!.id;
      setProfile({
        id: user!.id,
        full_name: user!.user_metadata?.full_name ?? user!.email ?? "",
        is_active: true,
        roles: [],
      });
      setLoading(false);
    }, 8000);

    async function load() {
      try {
        // 1. Ensure profile exists (upsert)
        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select("id, full_name, is_active")
          .eq("id", user!.id)
          .maybeSingle();

        if (profErr) {
          console.warn("[useUserProfile] profile fetch failed", profErr.message);
        }

        if (!prof) {
          await supabase.from("profiles").insert({
            id: user!.id,
            full_name: user!.user_metadata?.full_name ?? user!.email ?? "",
          });
        }

        // 2. Fetch roles
        const { data: rolesData, error: rolesErr } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user!.id);

        if (rolesErr) {
          console.warn("[useUserProfile] roles fetch failed", rolesErr.message);
        }

        if (cancelled) return;
        window.clearTimeout(safetyTimer);

        prevUserId.current = user!.id;

        setProfile({
          id: user!.id,
          full_name: prof?.full_name ?? user!.user_metadata?.full_name ?? "",
          is_active: prof?.is_active ?? true,
          roles: (rolesData ?? []).map((r) => r.role as AppRole),
        });
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        window.clearTimeout(safetyTimer);
        console.error("[useUserProfile] unexpected load error", err);
        // Libera a UI mesmo em erro — evita tela travada de loading.
        prevUserId.current = user!.id;
        setProfile({
          id: user!.id,
          full_name: user!.user_metadata?.full_name ?? user!.email ?? "",
          is_active: true,
          roles: [],
        });
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      window.clearTimeout(safetyTimer);
    };
  }, [user]);

  const value = useMemo(() => {
    const hasRole = (role: AppRole) => profile?.roles.includes(role) ?? false;
    return {
      profile,
      loading,
      hasRole,
      isAdmin: hasRole("admin"),
      isComercial: hasRole("comercial"),
      isOrcamentista: hasRole("orcamentista"),
    };
  }, [profile, loading]);

  return createElement(UserProfileContext.Provider, { value }, children);
}

/**
 * Hook to access the current user's profile + roles.
 * Must be used within a UserProfileProvider.
 */
export function useUserProfile() {
  return useContext(UserProfileContext);
}
