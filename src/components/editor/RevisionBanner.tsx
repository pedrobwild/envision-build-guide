import { useState } from "react";
import { RotateCcw, ChevronDown, ChevronUp, User, Clock, Loader2, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/formatBRL";

const CHANGE_TYPE_LABELS: Record<string, string> = {
  inclusion: "Inclusão de itens ou escopo",
  removal: "Remoção de itens ou escopo",
  price: "Revisão de preços",
  scope: "Alteração de especificações técnicas",
  other: "Outro",
};

interface RevisionBannerProps {
  revisionData: {
    id: string;
    metadata: Record<string, unknown> | null;
    created_at: string;
    note: string | null;
  };
  onStartRevision: () => void;
  startingRevision?: boolean;
}

export function RevisionBanner({ revisionData, onStartRevision, startingRevision }: RevisionBannerProps) {
  const [expanded, setExpanded] = useState(true);

  const meta = revisionData.metadata ?? {};
  const instructions = String((meta as Record<string, unknown>).instructions ?? "");
  const changeTypes = Array.isArray((meta as Record<string, unknown>).change_types) ? (meta as Record<string, unknown>).change_types as string[] : [];
  const requestedBy = String((meta as Record<string, unknown>).requested_by_name ?? "Comercial");

  return (
    <div className="rounded-xl border-2 border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
            <RotateCcw className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="text-left min-w-0">
            <h3 className="font-display font-bold text-sm text-orange-900 dark:text-orange-200">
              Revisão Solicitada pelo Comercial
            </h3>
            <p className="text-xs text-orange-700 dark:text-orange-400 font-body flex items-center gap-1.5 mt-0.5">
              <User className="h-3 w-3" />
              {requestedBy}
              <span className="mx-1">·</span>
              <Clock className="h-3 w-3" />
              {revisionData.created_at ? formatDate(revisionData.created_at) : "—"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-orange-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-orange-500" />
          )}
        </div>
      </button>

      {/* Expandable content */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-orange-200 dark:border-orange-800 pt-4">
          {/* Change types */}
          {changeTypes.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-body font-semibold text-orange-800 dark:text-orange-300 uppercase tracking-wide">
                Tipo de alteração
              </p>
              <div className="flex flex-wrap gap-1.5">
                {changeTypes.map((ct) => (
                  <Badge
                    key={ct}
                    variant="outline"
                    className="text-xs font-body border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300 bg-orange-100/50 dark:bg-orange-900/30"
                  >
                    {CHANGE_TYPE_LABELS[ct] ?? ct}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          {instructions && (
            <div className="space-y-1.5">
              <p className="text-xs font-body font-semibold text-orange-800 dark:text-orange-300 uppercase tracking-wide">
                Instruções
              </p>
              <div className="rounded-lg bg-white dark:bg-background border border-orange-200 dark:border-orange-800 px-4 py-3">
                <p className="text-sm font-body text-foreground whitespace-pre-wrap leading-relaxed">
                  {instructions}
                </p>
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="flex items-center gap-3 pt-1">
            <Button
              onClick={onStartRevision}
              disabled={startingRevision}
              className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
              size="sm"
            >
              {startingRevision ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GitBranch className="h-4 w-4" />
              )}
              Criar Nova Versão para Revisão
            </Button>
            <p className="text-xs text-orange-600 dark:text-orange-400 font-body">
              Uma cópia será criada como nova versão para aplicar as alterações.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
