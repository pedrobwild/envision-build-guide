/**
 * Indicador visual do status do link público no card do Kanban comercial.
 *
 * Reduz "abertura quebrada" mostrando ANTES do clique se o link vai abrir
 * direto (publicado) ou se vai precisar resolver via fallback (rascunho —
 * pode acabar em 404 se nenhuma versão do grupo estiver publicada).
 *
 * Estados:
 *   - "published"  → verde, ícone Eye, tooltip "Link público pronto"
 *   - "draft"      → âmbar, ícone EyeOff + dot, tooltip "Versão atual em rascunho — vai abrir a última publicada"
 *   - "missing"    → cinza, oculto por padrão (renderiza apenas se showMissing=true)
 *
 * Sem cores extras: usa tokens semânticos do design system.
 */
import { Eye, EyeOff, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type PublicLinkStatus = "published" | "draft" | "missing";

interface PublicLinkStatusBadgeProps {
  publicId?: string | null;
  status?: string | null;
  /** Se true, mostra o badge mesmo sem public_id (default: false). */
  showMissing?: boolean;
  /**
   * Quando informado e o estado for "draft", renderiza um botão inline
   * para regenerar/publicar o link público sem sair do card.
   */
  onRepublish?: () => void | Promise<void>;
  className?: string;
}

const PUBLISHED_STATUSES = new Set(["published", "minuta_solicitada"]);

export function derivePublicLinkStatus(
  publicId?: string | null,
  status?: string | null,
): PublicLinkStatus {
  if (!publicId) return "missing";
  if (PUBLISHED_STATUSES.has(status ?? "")) return "published";
  return "draft";
}

const STATE_META: Record<
  PublicLinkStatus,
  { label: string; tooltip: string; classes: string; icon: typeof Eye; dot?: boolean }
> = {
  published: {
    label: "Público",
    tooltip:
      "Link público pronto: clicar em Visualizar abre a versão publicada deste grupo.",
    classes: "bg-success/10 text-success ring-1 ring-success/25",
    icon: Eye,
  },
  draft: {
    label: "Rascunho",
    tooltip:
      "Versão atual está em rascunho. Visualizar tenta abrir a última publicada do grupo — se não houver, mostra erro em vez de 404.",
    classes: "bg-warning/10 text-warning ring-1 ring-warning/25",
    icon: EyeOff,
    dot: true,
  },
  missing: {
    label: "Sem link",
    tooltip: "Este orçamento ainda não tem link público gerado.",
    classes: "bg-muted/60 text-muted-foreground ring-1 ring-border/50",
    icon: EyeOff,
  },
};

export function PublicLinkStatusBadge({
  publicId,
  status,
  showMissing = false,
  onRepublish,
  className,
}: PublicLinkStatusBadgeProps) {
  const state = derivePublicLinkStatus(publicId, status);
  const [busy, setBusy] = useState(false);

  if (state === "missing" && !showMissing) return null;

  const meta = STATE_META[state];
  const Icon = meta.icon;
  const showRepublish = (state === "draft" || (state === "missing" && showMissing)) && !!onRepublish;

  async function handleRepublish(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!onRepublish || busy) return;
    setBusy(true);
    try {
      await onRepublish();
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[9.5px] font-medium font-body px-1.5 py-0.5 rounded-md",
          meta.classes,
        )}
        title={meta.tooltip}
        aria-label={`Status do link público: ${meta.label}`}
      >
        <Icon className="h-2.5 w-2.5" aria-hidden />
        {meta.label}
        {meta.dot && (
          <span
            className="h-1 w-1 rounded-full bg-warning animate-pulse"
            aria-hidden
          />
        )}
      </span>
      {showRepublish && (
        <button
          type="button"
          onClick={handleRepublish}
          disabled={busy}
          className={cn(
            "inline-flex items-center gap-1 text-[9.5px] font-semibold font-body px-1.5 py-0.5 rounded-md",
            "bg-primary/10 text-primary ring-1 ring-primary/30 hover:bg-primary/20 transition-colors",
            "disabled:opacity-60 disabled:cursor-not-allowed",
          )}
          title={
            state === "draft"
              ? "Publicar esta versão e atualizar o link público"
              : "Gerar link público para este orçamento"
          }
          aria-label="Publicar link público"
        >
          {busy ? (
            <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-2.5 w-2.5" aria-hidden />
          )}
          {busy ? "Publicando…" : "Publicar"}
        </button>
      )}
    </span>
  );
}
