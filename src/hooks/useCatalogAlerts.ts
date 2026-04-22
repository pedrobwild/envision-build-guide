import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CatalogAlertsConfig {
  id: string;
  stale_price_days: number;
  high_lead_time_days: number;
  max_price_increase_pct: number;
  updated_at: string;
}

export interface CatalogIssue {
  severity: "warning" | "error";
  code:
    | "no_price"
    | "stale_price"
    | "no_active_supplier"
    | "high_lead_time";
  message: string;
}

export interface CatalogAlertResult {
  issues: CatalogIssue[];
  worst: "none" | "warning" | "error";
}

/** Singleton config for catalog alert thresholds */
export function useCatalogAlertsConfig() {
  return useQuery<CatalogAlertsConfig | null>({
    queryKey: ["catalog_alerts_config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalog_alerts_config")
        .select("id, stale_price_days, high_lead_time_days, max_price_increase_pct, updated_at")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as CatalogAlertsConfig | null;
    },
    staleTime: 60_000,
  });
}

interface PrimaryPriceLite {
  unit_price: number | null;
  lead_time_days: number | null;
  is_active: boolean;
  updated_at: string | null;
}

/**
 * Pure function — easy to use directly in render with cached prices/config.
 * `primaryPrice` may be null when the item has no primary supplier.
 */
export function evaluateCatalogIssues(
  primaryPrice: PrimaryPriceLite | null,
  config: CatalogAlertsConfig | null,
): CatalogAlertResult {
  const issues: CatalogIssue[] = [];
  const stalePriceDays = config?.stale_price_days ?? 90;
  const highLeadTimeDays = config?.high_lead_time_days ?? 30;

  if (!primaryPrice) {
    issues.push({
      severity: "error",
      code: "no_price",
      message: "Sem preço primário cadastrado",
    });
  } else {
    if (!primaryPrice.is_active) {
      issues.push({
        severity: "error",
        code: "no_active_supplier",
        message: "Fornecedor primário inativo",
      });
    }
    if (primaryPrice.updated_at) {
      const daysSince =
        (Date.now() - new Date(primaryPrice.updated_at).getTime()) / 86_400_000;
      if (daysSince > stalePriceDays) {
        issues.push({
          severity: "warning",
          code: "stale_price",
          message: `Preço sem atualização há ${Math.round(daysSince)} dias`,
        });
      }
    }
    if (
      primaryPrice.lead_time_days != null &&
      primaryPrice.lead_time_days > highLeadTimeDays
    ) {
      issues.push({
        severity: "warning",
        code: "high_lead_time",
        message: `Prazo de entrega alto (${primaryPrice.lead_time_days} dias)`,
      });
    }
  }

  const worst: CatalogAlertResult["worst"] = issues.some((i) => i.severity === "error")
    ? "error"
    : issues.length > 0
      ? "warning"
      : "none";

  return { issues, worst };
}
