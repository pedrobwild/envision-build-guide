import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Tour3DRoom = {
  id: string;
  label: string;
  url: string;
};

export function useBudgetTours(publicId: string | undefined) {
  const [rooms, setRooms] = useState<Tour3DRoom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!publicId) {
      setRooms([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchTours() {
      setLoading(true);

      // Get budget id from public_id, then fetch tours
      const { data: budget } = await supabase
        .from("budgets")
        .select("id")
        .eq("public_id", publicId!)
        .maybeSingle();

      if (cancelled || !budget) {
        if (!cancelled) { setRooms([]); setLoading(false); }
        return;
      }

      const { data: tours } = await supabase
        .from("budget_tours")
        .select("room_id, room_label, tour_url")
        .eq("budget_id", budget.id)
        .order("order_index", { ascending: true });

      if (cancelled) return;

      setRooms(
        (tours ?? []).map((t) => ({
          id: t.room_id,
          label: t.room_label,
          url: t.tour_url,
        }))
      );
      setLoading(false);
    }

    fetchTours();
    return () => { cancelled = true; };
  }, [publicId]);

  return { rooms, loading };
}
