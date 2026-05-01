/**
 * SectionHeader — título de seção com hierarquia clara (Atlassian-like).
 *
 * Estrutura:
 *   eyebrow (opcional, label-caps semântico)
 *   título grande + count badge (opcional) + ações à direita
 *   descrição (opcional, ink-medium 13px)
 *
 * Usado para abrir blocos de conteúdo nas homes. Substitui os
 * `<h2 className="text-sm ...">` espalhados.
 */

import type { ReactNode, ElementType } from "react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: ElementType;
  count?: number | null;
  actions?: ReactNode;
  className?: string;
  /** Tom semântico opcional do eyebrow */
  tone?: "neutral" | "info" | "warn" | "danger" | "success";
}

const EYEBROW_TONE = {
  neutral: "text-ink-soft",
  info: "text-info",
  warn: "text-warn",
  danger: "text-danger",
  success: "text-[hsl(var(--success))]",
} as const;

export function SectionHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  count,
  actions,
  className,
  tone = "neutral",
}: SectionHeaderProps) {
  return (
    <header className={cn("flex items-end justify-between gap-4 mb-4", className)}>
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className={cn("text-[11px] font-semibold uppercase tracking-[0.1em] mb-1.5 font-body", EYEBROW_TONE[tone])}>
            {eyebrow}
          </p>
        )}
        <div className="flex items-center gap-2.5">
          {Icon && <Icon className="h-[18px] w-[18px] text-ink-medium shrink-0" aria-hidden />}
          <h2 className="text-[17px] sm:text-lg font-semibold font-display text-ink-strong tracking-tight leading-none">
            {title}
          </h2>
          {typeof count === "number" && (
            <span className="text-[11px] font-mono tabular-nums text-ink-soft bg-neutral-bg border border-neutral-border rounded-md px-1.5 py-0.5 leading-none">
              {count}
            </span>
          )}
        </div>
        {description && (
          <p className="text-[13px] text-ink-medium font-body mt-1.5 leading-snug">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
