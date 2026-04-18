import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModuleCardProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  meta?: string;
  badge?: { label: string; tone?: "neutral" | "success" | "warning" | "info" | "destructive" };
  badgeRight?: { label: string; tone?: "neutral" | "success" | "warning" | "info" | "destructive" };
  onClick?: () => void;
  active?: boolean;
  destructive?: boolean;
  disabled?: boolean;
}

const toneClasses: Record<string, string> = {
  neutral: "bg-muted text-foreground/80 border-border",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900",
  warning: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900",
  info: "bg-primary/10 text-primary border-primary/20",
  destructive: "bg-destructive/10 text-destructive border-destructive/20",
};

export function ModuleCard({
  icon: Icon,
  title,
  description,
  meta,
  badge,
  badgeRight,
  onClick,
  active,
  destructive,
  disabled,
}: ModuleCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group relative w-full text-left rounded-xl border bg-card p-5 transition-all",
        "hover:border-foreground/20 hover:shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        active && "border-primary/40 ring-2 ring-primary/15 shadow-sm",
        destructive && "hover:border-destructive/30",
        disabled && "opacity-60 cursor-not-allowed hover:shadow-none hover:border-border"
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className={cn(
            "h-9 w-9 rounded-lg flex items-center justify-center",
            destructive ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex items-center gap-2">
          {badgeRight && (
            <span className={cn("text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full border", toneClasses[badgeRight.tone ?? "neutral"])}>
              {badgeRight.label}
            </span>
          )}
          {!disabled && (
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground/70 transition-colors" />
          )}
        </div>
      </div>

      <h3 className={cn("text-sm font-display font-semibold leading-tight mb-1", destructive ? "text-destructive" : "text-foreground")}>
        {title}
      </h3>
      {description && (
        <p className="text-xs text-muted-foreground font-body leading-relaxed line-clamp-2">{description}</p>
      )}

      {(meta || badge) && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {badge && (
            <span className={cn("text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full border", toneClasses[badge.tone ?? "neutral"])}>
              {badge.label}
            </span>
          )}
          {meta && <span className="text-[11px] text-muted-foreground/70 font-body">{meta}</span>}
        </div>
      )}
    </button>
  );
}
