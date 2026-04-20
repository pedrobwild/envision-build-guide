import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Phone, Repeat, Mail, Calendar as CalIcon, ClipboardCheck,
  Flame, ChevronRight, Zap, Clock, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NewActivityDialog } from "@/components/agenda/NewActivityDialog";
import type { NextActionSuggestion } from "@/lib/deal-temperature";

interface CadenceRow {
  id: string;
  client_name: string;
  project_name: string;
  sequential_code?: string | null;
  internal_status: string;
  client_phone?: string | null;
  suggestion: NextActionSuggestion;
  daysSinceLastActivity: number | null;
  daysInStage: number | null;
}

interface CadencePanelProps {
  rows: CadenceRow[];
  /** Limite de itens mostrados antes do "ver todos" (default 6). */
  maxVisible?: number;
}

const TYPE_ICONS = {
  call: Phone,
  followup: Repeat,
  email: Mail,
  meeting: CalIcon,
  task: ClipboardCheck,
} as const;

const URGENCY_STYLES = {
  high: "border-destructive/40 bg-destructive/5",
  medium: "border-warning/40 bg-warning/5",
  low: "border-border bg-card",
  none: "border-border bg-card",
} as const;

const URGENCY_RANK: Record<NextActionSuggestion["urgency"], number> = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3,
};

export function CadencePanel({ rows, maxVisible = 6 }: CadencePanelProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [activityFor, setActivityFor] = useState<CadenceRow | null>(null);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const u = URGENCY_RANK[a.suggestion.urgency] - URGENCY_RANK[b.suggestion.urgency];
      if (u !== 0) return u;
      const da = a.daysSinceLastActivity ?? 999;
      const db = b.daysSinceLastActivity ?? 999;
      return db - da;
    });
  }, [rows]);

  const visible = expanded ? sorted : sorted.slice(0, maxVisible);
  const hidden = sorted.length - visible.length;

  const counts = useMemo(() => {
    return {
      total: rows.length,
      high: rows.filter((r) => r.suggestion.urgency === "high").length,
      medium: rows.filter((r) => r.suggestion.urgency === "medium").length,
    };
  }, [rows]);

  if (rows.length === 0) return null;

  return (
    <>
      <Card className="overflow-hidden border-border/70 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-warning/5 via-card to-card">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-warning/15 text-warning flex items-center justify-center">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-display text-sm font-semibold tracking-tight text-foreground">
                Próximas ações sugeridas
              </h3>
              <p className="text-[11px] text-muted-foreground font-body">
                Negócios que precisam de cadência agora
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {counts.high > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                <Flame className="h-3 w-3 mr-1" />
                {counts.high} urgente{counts.high > 1 ? "s" : ""}
              </Badge>
            )}
            {counts.medium > 0 && (
              <Badge className="text-[10px] bg-warning/15 text-warning hover:bg-warning/20 border-warning/30">
                {counts.medium} médio{counts.medium > 1 ? "s" : ""}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]">
              {counts.total} total
            </Badge>
          </div>
        </div>

        {/* Lista */}
        <ScrollArea className={cn(expanded && "max-h-[420px]")}>
          <ul className="divide-y divide-border/60">
            {visible.map((row) => {
              const Icon = TYPE_ICONS[row.suggestion.type] ?? ClipboardCheck;
              return (
                <li
                  key={row.id}
                  className={cn(
                    "group flex items-center gap-3 px-4 py-2.5 transition-colors",
                    URGENCY_STYLES[row.suggestion.urgency],
                    "hover:bg-muted/40"
                  )}
                >
                  <div
                    className={cn(
                      "h-8 w-8 rounded-md flex items-center justify-center shrink-0 ring-1",
                      row.suggestion.urgency === "high"
                        ? "bg-destructive/10 text-destructive ring-destructive/20"
                        : row.suggestion.urgency === "medium"
                          ? "bg-warning/15 text-warning ring-warning/25"
                          : "bg-muted text-muted-foreground ring-border"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {row.sequential_code && (
                        <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/60">
                          {row.sequential_code}
                        </span>
                      )}
                      <p className="text-[12px] font-display font-semibold text-foreground truncate">
                        {row.suggestion.label}
                      </p>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-body truncate">
                      {row.client_name}
                      {row.project_name && ` · ${row.project_name}`}
                      {row.daysSinceLastActivity !== null && (
                        <>
                          <span className="opacity-30 mx-1">•</span>
                          <Clock className="h-2.5 w-2.5 inline-block mr-0.5" />
                          {row.daysSinceLastActivity}d sem contato
                        </>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivityFor(row);
                      }}
                    >
                      <Plus className="h-3 w-3 mr-0.5" />
                      Agendar
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => navigate(`/admin/orcamento-interno/${row.id}`)}
                      title="Abrir negócio"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollArea>

        {/* Footer expand */}
        {hidden > 0 && (
          <div className="border-t bg-muted/30 p-2 text-center">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => setExpanded(true)}
            >
              Ver mais {hidden} sugest{hidden > 1 ? "ões" : "ão"}
            </Button>
          </div>
        )}
        {expanded && sorted.length > maxVisible && (
          <div className="border-t bg-muted/30 p-2 text-center">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => setExpanded(false)}
            >
              Recolher
            </Button>
          </div>
        )}
      </Card>

      {/* Dialog para criar atividade rapidamente */}
      {activityFor && (
        <NewActivityDialog
          open={!!activityFor}
          onOpenChange={(o) => !o && setActivityFor(null)}
          budgetId={activityFor.id}
          presetType={activityFor.suggestion.type}
          presetTitle={activityFor.suggestion.label}
        />
      )}
    </>
  );
}
