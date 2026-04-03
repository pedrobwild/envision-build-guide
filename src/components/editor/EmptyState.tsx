import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { LucideIcon } from "lucide-react";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "ghost";
  disabled?: boolean;
  tooltip?: string;
  icon?: LucideIcon;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: EmptyStateAction[];
  className?: string;
  compact?: boolean;
}

export function EmptyState({ icon: Icon, title, subtitle, actions, className, compact }: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-center",
      compact ? "py-6 gap-2" : "py-16 gap-3",
      "border border-dashed border-border/50 rounded-lg",
      className
    )}>
      <Icon className={cn("text-muted-foreground/25", compact ? "h-6 w-6" : "h-10 w-10")} />
      <div className="space-y-1">
        <p className={cn("font-body font-medium text-foreground/70", compact ? "text-xs" : "text-sm")}>{title}</p>
        {subtitle && (
          <p className={cn("font-body text-muted-foreground/50", compact ? "text-[10px]" : "text-xs")}>{subtitle}</p>
        )}
      </div>
      {actions && actions.length > 0 && (
        <div className="flex items-center gap-2 mt-1">
          {actions.map((action, i) => {
            const btn = (
              <Button
                key={i}
                size="sm"
                variant={action.variant || "default"}
                onClick={action.onClick}
                disabled={action.disabled}
                className="gap-1.5"
              >
                {action.icon && <action.icon className="h-3.5 w-3.5" />}
                {action.label}
              </Button>
            );
            if (action.tooltip) {
              return (
                <TooltipProvider key={i}>
                  <Tooltip>
                    <TooltipTrigger asChild>{btn}</TooltipTrigger>
                    <TooltipContent><p>{action.tooltip}</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            }
            return btn;
          })}
        </div>
      )}
    </div>
  );
}
