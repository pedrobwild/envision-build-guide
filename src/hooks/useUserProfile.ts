import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { AppRole } from "@/lib/role-constants";

export interface UserProfile {
  id: string;
  full_name: string;
  is_active: boolean;
  roles: AppRole[];
}

/**
 * Fetches (and auto-creates) the current user's profile + roles.
 * Re-runs whenever the auth user changes.
 */
export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);

      // 1. Ensure profile exists (upsert)
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();

      if (!prof) {
        await supabase.from("profiles").insert({
          id: user!.id,
          full_name: user!.user_metadata?.full_name ?? user!.email ?? "",
        });
      }

      // 2. Fetch roles
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);

      if (cancelled) return;

      setProfile({
        id: user!.id,
        full_name: prof?.full_name ?? user!.user_metadata?.full_name ?? "",
        is_active: prof?.is_active ?? true,
        roles: (rolesData ?? []).map((r: any) => r.role as AppRole),
      });
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [user]);

  const hasRole = (role: AppRole) => profile?.roles.includes(role) ?? false;
  const isAdmin = hasRole("admin");
  const isComercial = hasRole("comercial");
  const isOrcamentista = hasRole("orcamentista");

  return { profile, loading, hasRole, isAdmin, isComercial, isOrcamentista };
}
