/**
 * Modal "Detalhes do erro" para falhas de abertura de orçamento público.
 * Renderiza OpenBudgetDiagnosis em formato legível (outcome, IDs, flags, timeline).
 * Acionada via openDiagnosisDialog(diag) — toast só dispara o handler.
 */
import * as React from "react";
import { Copy, ExternalLink } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import type { OpenBudgetDiagnosis } from "@/lib/openPublicBudgetTelemetry";
import { cn } from "@/lib/utils";

type Listener = (state: { open: boolean; diag: OpenBudgetDiagnosis | null }) => void;

const store = {
  open: false,
  diag: null as OpenBudgetDiagnosis | null,
  listeners: new Set<Listener>(),
  set(next: { open: boolean; diag: OpenBudgetDiagnosis | null }) {
    this.open = next.open;
    this.diag = next.diag;
    this.listeners.forEach((l) => l(next));
  },
};

export function openDiagnosisDialog(diag: OpenBudgetDiagnosis) {
  store.set({ open: true, diag });
}

function closeDialog() {
  store.set({ open: false, diag: store.diag });
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function outcomeTone(outcome: OpenBudgetDiagnosis["outcome"]): {
  label: string;
  variant: "default" | "secondary" | "destructive";
  className?: string;
} {
  if (outcome.startsWith("blocked_")) {
    return { label: "Falha", variant: "destructive" };
  }
  if (outcome === "opened_original") {
    return {
      label: "Aberto com aviso",
      variant: "secondary",
      className: "bg-warning/15 text-warning-foreground border-warning/30",
    };
  }
  return {
    label: "Sucesso",
    variant: "secondary",
    className: "bg-success/15 text-success-foreground border-success/30",
  };
}

function copyToClipboard(value: string, label: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(value).then(
      () => toast.success(`${label} copiado.`),
      () => toast.error("Não foi possível copiar."),
    );
  } else {
    toast.error("Clipboard indisponível.");
  }
}

function IdRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-border/50 last:border-b-0">
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
          {label}
        </span>
        <code className="text-xs font-mono text-foreground break-all">{value}</code>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-[11px] gap-1 shrink-0"
        onClick={() => copyToClipboard(value, label)}
      >
        <Copy className="h-3 w-3" />
        Copiar
      </Button>
    </div>
  );
}

function StatusFlag({
  label,
  active,
  tone = "neutral",
}: {
  label: string;
  active: boolean;
  tone?: "neutral" | "danger" | "ok";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs",
        active && tone === "danger" && "bg-destructive/10 border-destructive/30 text-destructive",
        active && tone === "ok" && "bg-success/10 border-success/30 text-success-foreground",
        !active && "bg-muted/40 border-border text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          active && tone === "danger" && "bg-destructive",
          active && tone === "ok" && "bg-success",
          !active && "bg-muted-foreground/40",
        )}
      />
      {label}
    </div>
  );
}

export function OpenBudgetDiagnosisDialog() {
  const [state, setState] = React.useState<{ open: boolean; diag: OpenBudgetDiagnosis | null }>({
    open: store.open,
    diag: store.diag,
  });

  React.useEffect(() => {
    const listener: Listener = (next) => setState({ ...next });
    store.listeners.add(listener);
    return () => {
      store.listeners.delete(listener);
    };
  }, []);

  const diag = state.diag;
  const tone = diag ? outcomeTone(diag.outcome) : null;

  return (
    <Dialog open={state.open} onOpenChange={(open) => (open ? null : closeDialog())}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <DialogTitle>Detalhes do erro</DialogTitle>
            {tone && (
              <Badge variant={tone.variant} className={cn("text-[10px]", tone.className)}>
                {tone.label}
              </Badge>
            )}
          </div>
          <DialogDescription>
            Diagnóstico completo da última tentativa de abrir o orçamento público.
            Use os IDs abaixo ao reportar para o suporte.
          </DialogDescription>
        </DialogHeader>

        {!diag ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Nenhum diagnóstico disponível.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="rounded-md border bg-muted/30 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                  Outcome
                </div>
                <code className="text-xs font-mono break-all">{diag.outcome}</code>
              </div>
              <div className="rounded-md border bg-muted/30 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                  Duração
                </div>
                <div className="text-xs font-mono">{formatMs(diag.durationMs)}</div>
              </div>
              <div className="rounded-md border bg-muted/30 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                  Origem
                </div>
                <div className="text-xs font-mono">{diag.source}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusFlag
                label={diag.popupBlocked ? "Popup bloqueado" : "Popup OK"}
                active={diag.popupBlocked}
                tone="danger"
              />
              <StatusFlag
                label={diag.resolvedFrom ? `Resolvido via ${diag.resolvedFrom}` : "Não resolvido"}
                active={!!diag.resolvedFrom}
                tone="ok"
              />
              {diag.errorMessage && (
                <StatusFlag label="Erro registrado" active tone="danger" />
              )}
            </div>

            {diag.errorMessage && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-destructive font-medium mb-1">
                  Mensagem de erro
                </div>
                <div className="text-xs font-mono break-words text-destructive">
                  {diag.errorMessage}
                </div>
              </div>
            )}

            <div className="rounded-md border bg-card">
              <div className="px-3 py-2 border-b bg-muted/20">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                  Identificadores
                </span>
              </div>
              <div className="px-3">
                <IdRow label="Correlation ID" value={diag.correlationId} />
                <IdRow label="Session ID" value={diag.sessionId} />
                <IdRow label="Input public_id" value={diag.inputPublicId} />
                <IdRow label="Resolvido public_id" value={diag.resolvedPublicId} />
                <IdRow label="Budget ID" value={diag.inputBudgetId} />
                <IdRow label="Status de entrada" value={diag.inputStatus} />
              </div>
            </div>

            <div className="rounded-md border bg-card">
              <div className="px-3 py-2 border-b bg-muted/20">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                  Timeline ({diag.steps.length} passos)
                </span>
              </div>
              <ScrollArea className="max-h-64">
                <ol className="divide-y divide-border/60">
                  {diag.steps.map((s, i) => (
                    <li key={i} className="px-3 py-2 flex gap-3">
                      <div className="text-[10px] font-mono text-muted-foreground w-12 shrink-0 pt-0.5 tabular-nums">
                        +{s.ts}ms
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-mono font-medium">{s.step}</div>
                        {s.detail && Object.keys(s.detail).length > 0 && (
                          <pre className="mt-1 text-[11px] font-mono text-muted-foreground bg-muted/40 rounded px-2 py-1 overflow-x-auto whitespace-pre-wrap break-words">
                            {JSON.stringify(s.detail, null, 2)}
                          </pre>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </ScrollArea>
            </div>

            <Separator />

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(JSON.stringify(diag, null, 2), "Diagnóstico (JSON)")}
              >
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Copiar JSON
              </Button>
              {diag.resolvedPublicId && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    window.open(`/o/${diag.resolvedPublicId}`, "_blank", "noopener,noreferrer");
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Tentar abrir novamente
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
