import { Phone, Mail, Users, Clock, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NextActionSuggestion } from "@/lib/deal-temperature";

interface Props {
  suggestion: NextActionSuggestion;
  onClick?: (e: React.MouseEvent) => void;
  compact?: boolean;
}

const ICONS = {
  call: Phone,
  email: Mail,
  meeting: Users,
  followup: Clock,
  task: FileText,
} as const;

const URGENCY_STYLES = {
  high: "bg-destructive/10 text-destructive ring-destructive/20 hover:bg-destructive/15",
  medium: "bg-warning/10 text-warning ring-warning/20 hover:bg-warning/15",
  low: "bg-muted text-muted-foreground ring-border hover:bg-muted/80",
  none: "bg-muted text-muted-foreground ring-border hover:bg-muted/80",
} as const;

export function NextActionChip({ suggestion, onClick, compact }: Props) {
  const Icon = ICONS[suggestion.type] ?? Clock;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded-md ring-1 font-body font-medium transition-colors w-full justify-start truncate",
        compact ? "text-[10px] px-1.5 py-0.5" : "text-[10.5px] px-2 py-1",
        URGENCY_STYLES[suggestion.urgency],
      )}
      title={`Próxima ação sugerida: ${suggestion.label}`}
    >
      <Icon className={cn("shrink-0", compact ? "h-2.5 w-2.5" : "h-3 w-3")} />
      <span className="truncate">{suggestion.label}</span>
    </button>
  );
}
