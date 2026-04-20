import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sanitizePostgrestPattern } from "@/lib/postgrest-escape";

export interface DuplicateMatch {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  sequential_code: string | null;
  matched_by: ("email" | "phone" | "name")[];
}

interface CheckInput {
  name: string;
  email: string;
  phone: string;
  /** Ignora este id (usado em modo edição). */
  excludeId?: string | null;
  /** Debounce em ms (default 350). */
  debounceMs?: number;
}

/**
 * Detecta clientes duplicados em tempo real enquanto o usuário preenche o formulário.
 * Estratégia:
 *  - email: match exato case-insensitive
 *  - telefone: últimos 8 dígitos (ignora DDI/DDD variações)
 *  - nome: ilike em nome (apenas se >= 4 caracteres)
 *
 * Retorna até 5 matches, sinalizando por qual campo bateu.
 */
export function useDuplicateClientCheck({
  name,
  email,
  phone,
  excludeId,
  debounceMs = 350,
}: CheckInput): { matches: DuplicateMatch[]; loading: boolean } {
  const [matches, setMatches] = useState<DuplicateMatch[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    const phoneDigits = trimmedPhone.replace(/\D/g, "");
    const phoneTail = phoneDigits.length >= 6 ? phoneDigits.slice(-8) : "";

    const hasName = trimmedName.length >= 4;
    const hasEmail = trimmedEmail.length >= 5 && trimmedEmail.includes("@");
    const hasPhone = phoneTail.length >= 6;

    if (!hasName && !hasEmail && !hasPhone) {
      setMatches([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(async () => {
      const filters: string[] = [];
      if (hasEmail) {
        const safe = sanitizePostgrestPattern(trimmedEmail);
        if (safe) filters.push(`email.ilike.${safe}`);
      }
      if (hasPhone) {
        filters.push(`phone.ilike.%${phoneTail}%`);
      }
      if (hasName) {
        const safe = sanitizePostgrestPattern(trimmedName);
        if (safe) filters.push(`name.ilike.%${safe}%`);
      }
      if (filters.length === 0) {
        if (!cancelled) {
          setMatches([]);
          setLoading(false);
        }
        return;
      }

      let query = supabase
        .from("clients")
        .select("id, name, email, phone, sequential_code")
        .eq("is_active", true)
        .or(filters.join(","))
        .limit(5);

      if (excludeId) {
        query = query.neq("id", excludeId);
      }

      const { data, error } = await query;
      if (cancelled) return;

      if (error) {
        setMatches([]);
        setLoading(false);
        return;
      }

      const enriched: DuplicateMatch[] = (data ?? []).map((c) => {
        const matchedBy: DuplicateMatch["matched_by"] = [];
        if (hasEmail && c.email && c.email.toLowerCase() === trimmedEmail.toLowerCase()) {
          matchedBy.push("email");
        }
        if (hasPhone && c.phone) {
          const digits = c.phone.replace(/\D/g, "");
          if (digits.endsWith(phoneTail)) matchedBy.push("phone");
        }
        if (
          hasName &&
          c.name &&
          c.name.toLowerCase().includes(trimmedName.toLowerCase())
        ) {
          matchedBy.push("name");
        }
        return {
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          sequential_code: c.sequential_code,
          matched_by: matchedBy.length > 0 ? matchedBy : ["name"],
        };
      });

      // Sort: email matches first, then phone, then name-only
      enriched.sort((a, b) => {
        const score = (m: DuplicateMatch) =>
          (m.matched_by.includes("email") ? 0 : 10) +
          (m.matched_by.includes("phone") ? 0 : 5);
        return score(a) - score(b);
      });

      setMatches(enriched);
      setLoading(false);
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [name, email, phone, excludeId, debounceMs]);

  return { matches, loading };
}
