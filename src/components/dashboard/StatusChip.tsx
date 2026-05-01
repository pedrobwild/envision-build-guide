/**
 * StatusChip — badge semântico com ponto de cor e label.
 *
 * Padrão Atlassian/Stripe: bg suave + border sutil + texto forte. Sempre
 * acompanha um indicador não-cromático (ponto + texto) para acessibilidade
 * (não dependemos só de cor).
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "info" | "success" | "warn" | "danger";
type Size = "sm" | "md";

interface StatusChipProps {
  tone?: Tone;
  size?: Size;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

const TONE: Record<Tone, { bg: string; border: string; text: string; dot: string }> = {
  neutral: {
    bg: "bg-neutral-bg",
    border: "border-neutral-border",
    text: "text-ink-medium",
    dot: "bg-ink-soft",
  },
  info: {
    bg: "bg-info-bg",
    border: "border-info-border",
    text: "text-info",
    dot: "bg-info",
  },
  success: {
    bg: "bg-success-bg",
    border: "border-success-border",
    text: "text-[hsl(var(--success))]",
    dot: "bg-[hsl(var(--success))]",
  },
  warn: {
    bg: "bg-warn-bg",
    border: "border-warn-border",
    text: "text-warn",
    dot: "bg-warn",
  },
  danger: {
    bg: "bg-danger-bg",
    border: "border-danger-border",
    text: "text-danger",
    dot: "bg-danger",
  },
};

const SIZE: Record<Size, string> = {
  sm: "text-[10.5px] px-1.5 py-0.5 gap-1",
  md: "text-[11.5px] px-2 py-0.5 gap-1.5",
};

export function StatusChip({ tone = "neutral", size = "sm", dot = true, className, children }: StatusChipProps) {
  const t = TONE[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border font-body font-medium leading-none whitespace-nowrap",
        t.bg,
        t.border,
        t.text,
        SIZE[size],
        className,
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", t.dot)} aria-hidden />}
      {children}
    </span>
  );
}
