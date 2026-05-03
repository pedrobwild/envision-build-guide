import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

export interface DemandNavItem {
  key: string;
  icon: LucideIcon;
  label: string;
  description?: string;
  badge?: { label: string; tone?: "neutral" | "info" | "success" | "warning" | "destructive" };
  destructive?: boolean;
  onClick: () => void;
  active?: boolean;
}

const TONE_CLASSES: Record<NonNullable<DemandNavItem["badge"]>["tone"] & string, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  info: "bg-primary/10 text-primary border-primary/20",
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  destructive: "bg-destructive/10 text-destructive border-destructive/20",
};

interface Props {
  items: DemandNavItem[];
  title?: string;
}

/**
 * Navegação de módulos da demanda.
 * - Desktop: lista vertical de cards com descrição.
 * - Mobile (<768px): chips scrolláveis horizontais (segmented strip), sem descrições,
 *   priorizando triagem rápida e tap target ≥40px. Mantém deep-link via `?module`
 *   pois cada `onClick` ativa o mesmo state.
 */
export function DemandSidebarNav({ items, title = "Módulos" }: Props) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <nav
        aria-label={title}
        className="-mx-3 px-3 sticky top-12 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border/60"
      >
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none py-2 snap-x-mandatory">
          {items.map((item) => {
            const Icon = item.icon;
            const tone = item.badge?.tone ?? "neutral";
            return (
              <button
                key={item.key}
                type="button"
                onClick={item.onClick}
                aria-pressed={!!item.active}
                className={cn(
                  "snap-start shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 h-10 text-xs font-body font-medium transition-colors",
                  item.active
                    ? "border-primary/50 bg-primary/10 text-primary shadow-sm"
                    : "border-border bg-card text-foreground/80 active:bg-muted/60",
                  item.destructive && !item.active && "border-destructive/30 text-destructive/90",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap">{item.label}</span>
                {item.badge && (
                  <span
                    className={cn(
                      "text-[9px] uppercase tracking-wide px-1 py-px rounded border leading-none",
                      TONE_CLASSES[tone],
                    )}
                  >
                    {item.badge.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <nav className="space-y-1" aria-label={title}>
      <h2 className="text-[10px] font-display font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
        {title}
      </h2>
      {items.map((item) => {
        const Icon = item.icon;
        const tone = item.badge?.tone ?? "neutral";
        return (
          <button
            key={item.key}
            type="button"
            onClick={item.onClick}
            aria-pressed={!!item.active}
            className={cn(
              "group w-full flex items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-all",
              item.active
                ? "border-primary/40 bg-primary/5 shadow-sm"
                : "border-border bg-card hover:border-border/80 hover:bg-muted/40",
              item.destructive && !item.active && "hover:border-destructive/30 hover:bg-destructive/[0.03]",
            )}
          >
            <span
              className={cn(
                "shrink-0 mt-0.5 h-7 w-7 rounded-md flex items-center justify-center transition-colors",
                item.active
                  ? "bg-primary/15 text-primary"
                  : item.destructive
                  ? "bg-destructive/10 text-destructive/80 group-hover:bg-destructive/15"
                  : "bg-muted text-muted-foreground group-hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={cn(
                    "text-[12.5px] font-body font-medium leading-tight",
                    item.active ? "text-foreground" : "text-foreground/90",
                    item.destructive && !item.active && "text-foreground/80",
                  )}
                >
                  {item.label}
                </span>
                {item.badge && (
                  <span
                    className={cn(
                      "text-[9px] font-body uppercase tracking-wide px-1.5 py-px rounded border leading-none",
                      TONE_CLASSES[tone],
                    )}
                  >
                    {item.badge.label}
                  </span>
                )}
              </div>
              {item.description && (
                <p className="text-[10.5px] text-muted-foreground font-body mt-0.5 line-clamp-2 leading-snug">
                  {item.description}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </nav>
  );
}
