/**
 * EmptyState — estado vazio premium para zonas operacionais.
 *
 * Sempre dá contexto (o que é) + ação concreta (o que fazer).
 */

import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: ElementType;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  size?: "sm" | "md";
}

export function EmptyState({ icon: Icon, title, description, action, className, size = "md" }: EmptyStateProps) {
  const compact = size === "sm";
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center justify-center",
        compact ? "py-6 px-4" : "py-10 px-6",
        className,
      )}
    >
      <div
        className={cn(
          "rounded-full bg-neutral-bg border border-hairline flex items-center justify-center mb-3",
          compact ? "h-9 w-9" : "h-11 w-11",
        )}
      >
        <Icon className={cn("text-ink-soft", compact ? "h-4 w-4" : "h-5 w-5")} aria-hidden />
      </div>
      <p className={cn("font-display font-semibold text-ink-strong tracking-tight", compact ? "text-sm" : "text-[15px]")}>
        {title}
      </p>
      {description && (
        <p className={cn("text-ink-medium font-body mt-1 max-w-sm leading-snug", compact ? "text-xs" : "text-[13px]")}>
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
