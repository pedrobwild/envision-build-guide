/**
 * Surface — wrapper de superfície para o sistema de painéis enterprise.
 *
 * Hierarquia de elevação (Atlassian/Stripe):
 *   • flat       → sem fundo próprio, só agrupamento (use em zonas internas)
 *   • sunken     → surface-2, para conteúdos secundários dentro de um card
 *   • raised     → surface-1 + hairline + shadow-card (o card padrão)
 *   • floating   → surface-1 + shadow-raised (chamadas de atenção)
 *
 * Padding padronizado em 3 tamanhos. Sempre usa raio 2xl para uma sensação
 * mais moderna/premium (vs. xl genérico do shadcn).
 */

import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "flat" | "sunken" | "raised" | "floating";
type Padding = "none" | "sm" | "md" | "lg";

interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  padding?: Padding;
  interactive?: boolean;
}

const VARIANT: Record<Variant, string> = {
  flat: "bg-transparent",
  sunken: "bg-surface-2 border border-hairline/60",
  raised: "bg-surface-1 border border-hairline shadow-card",
  floating: "bg-surface-1 border border-hairline shadow-raised",
};

const PADDING: Record<Padding, string> = {
  none: "",
  sm: "p-4",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-8",
};

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(
  ({ variant = "raised", padding = "md", interactive, className, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl",
        VARIANT[variant],
        PADDING[padding],
        interactive &&
          "transition-all duration-200 hover:border-hairline-strong hover:shadow-raised cursor-pointer",
        className,
      )}
      {...rest}
    />
  ),
);
Surface.displayName = "Surface";
