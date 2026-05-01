/**
 * PainelHeader — hero operacional dos painéis (Admin / Comercial / Orçamentista).
 *
 * Hierarquia (Atlassian/Stripe):
 *   eyebrow → "PAINEL · {ROLE}"
 *   título grande (Sora 24-28px) com saudação contextualizada
 *   subtítulo informativo (Inter 14-15px, ink-medium) — diz o que importa AGORA
 *   ações à direita (RoleSwitcher + slot livre)
 *
 * Pode opcionalmente renderizar uma "context strip" abaixo (slot `meta`)
 * para acomodar barras de meta, filtros ativos, etc.
 */

import { useMemo, type ReactNode } from "react";
import { Briefcase, Hammer, ShieldCheck } from "lucide-react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useActiveRole } from "@/hooks/useActiveRole";
import { ROLES, type AppRole } from "@/lib/role-constants";
import { RoleSwitcher } from "./RoleSwitcher";
import { cn } from "@/lib/utils";

interface PainelHeaderProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Conteúdo opcional logo abaixo do header (ex.: barra de meta do mês). */
  meta?: ReactNode;
  className?: string;
}

const ROLE_META: Record<AppRole, { icon: typeof Briefcase; eyebrow: string }> = {
  admin: { icon: ShieldCheck, eyebrow: "Painel · Admin" },
  comercial: { icon: Briefcase, eyebrow: "Painel · Comercial" },
  orcamentista: { icon: Hammer, eyebrow: "Painel · Produção" },
};

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function PainelHeader({ title, subtitle, actions, meta, className }: PainelHeaderProps) {
  const { profile } = useUserProfile();
  const { activeRole } = useActiveRole();

  const firstName = useMemo(() => {
    const n = profile?.full_name?.trim() || "";
    return n.split(/\s+/)[0] || "";
  }, [profile?.full_name]);

  const computedTitle = title || `${greetingByHour()}${firstName ? `, ${firstName}` : ""}`;
  const roleMeta = activeRole ? ROLE_META[activeRole] : null;

  return (
    <header className={cn("space-y-5", className)}>
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="min-w-0 flex-1">
          {roleMeta && (
            <div className="flex items-center gap-2 mb-2">
              <roleMeta.icon className="h-3.5 w-3.5 text-info" aria-hidden />
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-info font-body">
                {roleMeta.eyebrow}
              </p>
            </div>
          )}
          <h1 className="text-2xl sm:text-[28px] font-semibold font-display text-ink-strong tracking-tight leading-[1.1]">
            {computedTitle}
          </h1>
          {subtitle && (
            <p className="text-[14px] sm:text-[15px] text-ink-medium font-body mt-2 leading-snug max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <RoleSwitcher />
          {actions && (
            <>
              <span className="hidden sm:block w-px h-6 bg-hairline mx-1" aria-hidden />
              {actions}
            </>
          )}
        </div>
      </div>
      {meta && <div>{meta}</div>}
    </header>
  );
}
