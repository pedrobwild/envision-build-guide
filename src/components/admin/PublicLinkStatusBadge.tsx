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
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type PublicLinkStatus = "published" | "draft" | "missing";

interface PublicLinkStatusBadgeProps {
  publicId?: string | null;
  status?: string | null;
  /** Se true, mostra o badge mesmo sem public_id (default: false). */
  showMissing?: boolean;
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
  className,
}: PublicLinkStatusBadgeProps) {
  const state = derivePublicLinkStatus(publicId, status);
  if (state === "missing" && !showMissing) return null;

  const meta = STATE_META[state];
  const Icon = meta.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[9.5px] font-medium font-body px-1.5 py-0.5 rounded-md",
        meta.classes,
        className,
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
  );
}
