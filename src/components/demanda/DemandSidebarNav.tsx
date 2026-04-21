import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
 * Lista vertical de botões para acessar os módulos de uma demanda.
 * Usado na coluna esquerda da página /admin/demanda/:id.
 */
export function DemandSidebarNav({ items, title = "Módulos" }: Props) {
  return (
    <nav className="space-y-1">
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
