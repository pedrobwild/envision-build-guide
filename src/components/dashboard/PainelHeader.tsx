/**
 * PainelHeader — header padrão dos 3 painéis (Comercial / Orçamentista / Admin).
 *
 * Estrutura:
 *   • Coluna esquerda: saudação + papel atual + 1 linha de contexto.
 *   • Coluna direita: ações (RoleSwitcher + slot livre — filtro/CTA).
 */

import { useMemo, type ReactNode } from "react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { RoleSwitcher } from "./RoleSwitcher";

interface PainelHeaderProps {
  /** Linha 1: título grande (ex.: "Bom dia, Pedro"). Default: derivado do nome + hora. */
  title?: string;
  /** Linha 2: subtítulo curto (ex.: "Você tem 3 itens críticos hoje"). */
  subtitle?: string;
  /** Slot direito: filtros, botões — qualquer ação contextual. */
  actions?: ReactNode;
}

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function PainelHeader({ title, subtitle, actions }: PainelHeaderProps) {
  const { profile } = useUserProfile();
  const firstName = useMemo(() => {
    const n = profile?.full_name?.trim() || "";
    return n.split(/\s+/)[0] || "";
  }, [profile?.full_name]);

  const computedTitle = title || `${greetingByHour()}${firstName ? `, ${firstName}` : ""}`;

  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold font-display text-foreground tracking-tight truncate">
          {computedTitle}
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground font-body mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <RoleSwitcher />
        {actions}
      </div>
    </div>
  );
}
