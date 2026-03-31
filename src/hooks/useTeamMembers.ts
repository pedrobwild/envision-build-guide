import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/role-constants";

export interface TeamMember {
  id: string;
  full_name: string;
  role: AppRole;
}

/**
 * Fetches team members filtered by role.
 * Joins profiles + user_roles to get name and role.
 */
export function useTeamMembers(role?: AppRole) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      // Fetch all user_roles (optionally filtered)
      let query = supabase.from("user_roles").select("user_id, role");
      if (role) {
        query = query.eq("role", role);
      }
      const { data: roles } = await query;
      if (cancelled || !roles || roles.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }

      const userIds = [...new Set(roles.map((r) => r.user_id))];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds)
        .eq("is_active", true);

      if (cancelled) return;

      const profileMap = new Map(
        (profiles ?? []).map((p) => [p.id, p.full_name ?? ""])
      );

      const result: TeamMember[] = roles
        .filter((r) => profileMap.has(r.user_id))
        .map((r) => ({
          id: r.user_id,
          full_name: profileMap.get(r.user_id) || "(sem nome)",
          role: r.role as AppRole,
        }));

      // Deduplicate by user_id (a user may have multiple roles)
      const seen = new Set<string>();
      const deduped = result.filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });

      setMembers(deduped);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [role]);

  return { members, loading };
}
