import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/role-constants";

export interface TeamMember {
  id: string;
  full_name: string;
  role: AppRole;
}

/**
 * Fetches team members filtered by role via the SECURITY DEFINER RPC
 * `get_team_members`. This avoids exposing the full `user_roles` table to
 * non-admin clients while still allowing assignment dropdowns to populate.
 */
export function useTeamMembers(role?: AppRole) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const { data, error } = await supabase.rpc("get_team_members", {
        _role: role ?? null,
      });

      if (cancelled) return;

      if (error || !data) {
        setMembers([]);
        setLoading(false);
        return;
      }

      const result: TeamMember[] = (data as Array<{ id: string; full_name: string | null; role: AppRole }>).map(
        (m) => ({
          id: m.id,
          full_name: m.full_name || "(sem nome)",
          role: m.role,
        }),
      );

      setMembers(result);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [role]);

  return { members, loading };
}
