/**
 * useActiveRole — papel ativo do usuário (papel que ele escolheu
 * como visão de trabalho).
 *
 * Regras:
 *   • Se `profiles.active_role` está setado E o usuário ainda
 *     possui esse papel → usa ele.
 *   • Caso contrário → fallback pelo papel primário em ordem:
 *     admin > comercial > orcamentista.
 *
 * Persistência: chamada `setActiveRole` invoca a RPC
 * `set_active_role` (validada server-side) e atualiza o cache.
 */

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useUserProfile } from "./useUserProfile";
import type { AppRole } from "@/lib/role-constants";
import { logger } from "@/lib/logger";

const ROLE_PRIORITY: AppRole[] = ["admin", "comercial", "orcamentista"];

/** Resolve papel ativo a partir do que está persistido + papéis disponíveis. */
function resolveActiveRole(
  persisted: AppRole | null | undefined,
  available: AppRole[],
): AppRole | null {
  if (persisted && available.includes(persisted)) return persisted;
  for (const role of ROLE_PRIORITY) {
    if (available.includes(role)) return role;
  }
  return null;
}

export interface UseActiveRoleReturn {
  /** Papel atualmente em uso (resolvido). */
  activeRole: AppRole | null;
  /** Papéis que o usuário pode escolher. */
  availableRoles: AppRole[];
  /** Indica se a primeira leitura está em andamento. */
  loading: boolean;
  /** Persiste novo papel no Supabase + atualiza cache local. */
  setActiveRole: (role: AppRole) => Promise<void>;
  /** Volta ao papel primário (limpa override). */
  clearActiveRole: () => Promise<void>;
}

export function useActiveRole(): UseActiveRoleReturn {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();

  const [persisted, setPersisted] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  // Lê profiles.active_role 1x por usuário.
  useEffect(() => {
    if (!user) {
      setPersisted(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function load() {
      try {
        const { data, error } = await supabase
          .from("profiles")
          // active_role pode ainda não existir no tipo gerado (nova migration);
          // fazemos o cast para evitar erro de tipo até a regeneração.
          .select("active_role")
          .eq("id", user!.id)
          .maybeSingle<{ active_role: AppRole | null }>();
        if (cancelled) return;
        if (error) {
          logger.warn("[useActiveRole] failed to load active_role", error.message);
          setPersisted(null);
        } else {
          setPersisted((data?.active_role ?? null) as AppRole | null);
        }
      } catch (err) {
        if (!cancelled) {
          logger.warn("[useActiveRole] unexpected error", err);
          setPersisted(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const availableRoles = profile?.roles ?? [];
  const activeRole = resolveActiveRole(persisted, availableRoles);

  const setActiveRole = useCallback(
    async (role: AppRole) => {
      if (!user) return;
      // Optimistic update
      setPersisted(role);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("set_active_role", { _role: role });
      if (error) {
        logger.warn("[useActiveRole] set_active_role failed", error.message);
        // Reverte para o que estava (releitura)
        const { data } = await supabase
          .from("profiles")
          .select("active_role")
          .eq("id", user.id)
          .maybeSingle<{ active_role: AppRole | null }>();
        setPersisted((data?.active_role ?? null) as AppRole | null);
        throw error;
      }
    },
    [user],
  );

  const clearActiveRole = useCallback(async () => {
    if (!user) return;
    setPersisted(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("clear_active_role");
    if (error) {
      logger.warn("[useActiveRole] clear_active_role failed", error.message);
    }
  }, [user]);

  return {
    activeRole,
    availableRoles,
    loading: loading || profileLoading,
    setActiveRole,
    clearActiveRole,
  };
}

/** Caminho da home para um papel específico. */
export function homePathForRole(role: AppRole | null): string {
  switch (role) {
    case "admin":
      return "/painel/admin";
    case "comercial":
      return "/painel/comercial";
    case "orcamentista":
      return "/painel/orcamentista";
    default:
      return "/admin";
  }
}
