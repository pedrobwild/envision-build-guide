import { Link, useNavigate } from "react-router-dom";
import { formatBRL, formatDate } from "@/lib/formatBRL";
import { getPublicBudgetUrl } from "@/lib/getPublicUrl";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Pencil, Eye, MoreHorizontal, Copy, GitCompare,
  Handshake, ShoppingBag, Archive, Trash2, ExternalLink,
  User, Calendar, Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BudgetListCardProps {
  budget: any;
  total: number;
  sectionCount: number;
  statusLabel: string;
  statusColor: string;
  onPublish: (id: string) => void;
  onCopyLink: (publicId: string) => void;
  onMarkClosed: (id: string) => void;
  onToggleOptionals: (id: string, current: boolean) => void;
  onDuplicate: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onCompareVersions?: (groupId: string) => void;
}

export function BudgetListCard({
  budget,
  total,
  sectionCount,
  statusLabel,
  statusColor,
  onPublish,
  onCopyLink,
  onMarkClosed,
  onToggleOptionals,
  onDuplicate,
  onArchive,
  onDelete,
  onCompareVersions,
}: BudgetListCardProps) {
  const navigate = useNavigate();

  const internalCost = Number(budget.internal_cost) || 0;
  const isClosed = budget.status === "contrato_fechado";
  const profit = total - internalCost;
  const profitMargin = total > 0 ? (profit / total) * 100 : 0;

  return (
    <div
      className="group relative bg-card hover:bg-accent/30 active:bg-accent/50 transition-colors cursor-pointer"
      onClick={() => navigate(`/admin/budget/${budget.id}`)}
    >
      <div className="px-4 py-3 sm:py-3.5">
        {/* Mobile: stacked layout / Desktop: row layout */}
        <div className="flex items-start gap-3">
          {/* Left: initials avatar */}
          <div className="hidden sm:flex h-10 w-10 rounded-lg bg-primary/10 text-primary items-center justify-center shrink-0 text-sm font-bold font-display">
            {(budget.project_name || "?")[0]?.toUpperCase()}
          </div>

          {/* Center: info */}
          <div className="flex-1 min-w-0">
            {/* Row 1: Project name + version + status */}
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              {budget.sequential_code && (
                <span className="text-[10px] font-mono text-muted-foreground/70 shrink-0">{budget.sequential_code}</span>
              )}
              <span className="font-semibold text-sm font-display text-foreground truncate max-w-[200px] sm:max-w-none">
                {budget.project_name || "Sem nome"}
              </span>
              {(budget.version_number ?? 1) > 1 && (
                <span className="text-[10px] bg-muted border border-border rounded px-1 py-px font-body font-medium text-muted-foreground">
                  V{budget.version_number}
                </span>
              )}
              <Badge
                variant="secondary"
                className={cn("text-[10px] px-1.5 py-0 font-body h-[18px]", statusColor)}
              >
                {statusLabel}
              </Badge>
              {budget.is_published_version && (
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" title="Versão publicada" />
              )}
            </div>

            {/* Row 2: Client + meta */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-body flex-wrap">
              <span className="flex items-center gap-1 truncate max-w-[140px] sm:max-w-none">
                <User className="h-3 w-3 shrink-0 opacity-60" />
                {budget.client_name}
              </span>
              {budget.date && (
                <span className="flex items-center gap-1 shrink-0">
                  <Calendar className="h-3 w-3 opacity-60" />
                  {formatDate(budget.date)}
                </span>
              )}
              <span className="flex items-center gap-1 shrink-0">
                <Layers className="h-3 w-3 opacity-60" />
                {sectionCount} {sectionCount === 1 ? "seção" : "seções"}
              </span>
              {budget.view_count > 0 && (
                <span className="flex items-center gap-1 shrink-0">
                  <Eye className="h-3 w-3 opacity-60" />
                  {budget.view_count}
                </span>
              )}
            </div>

            {/* Row 3 (conditional): profit info */}
            {isClosed && internalCost > 0 && (
              <div className="flex items-center gap-2 text-[11px] font-body mt-1">
                <span className="text-muted-foreground">Custo {formatBRL(internalCost)}</span>
                <span className={profit >= 0 ? "text-green-600 font-medium" : "text-destructive font-medium"}>
                  Lucro {formatBRL(profit)} ({profitMargin.toFixed(0)}%)
                </span>
              </div>
            )}
          </div>

          {/* Right: price + actions */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-sm font-display font-bold text-foreground whitespace-nowrap mr-1">
              {formatBRL(total)}
            </span>

            {/* Desktop action icons */}
            <div className="hidden sm:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => { e.stopPropagation(); navigate(`/admin/budget/${budget.id}`); }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              {budget.status === "draft" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => { e.stopPropagation(); onPublish(budget.id); }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              )}
              {budget.public_id && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => { e.stopPropagation(); window.open(getPublicBudgetUrl(budget.public_id!), "_blank"); }}
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            {/* More menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => navigate(`/admin/budget/${budget.id}`)}>
                  <Pencil className="h-4 w-4 mr-2" /> Editar
                </DropdownMenuItem>
                {budget.public_id && (
                  <DropdownMenuItem onClick={() => window.open(getPublicBudgetUrl(budget.public_id!), "_blank")}>
                    <Eye className="h-4 w-4 mr-2" /> Ver página pública
                  </DropdownMenuItem>
                )}
                {budget.public_id && (
                  <DropdownMenuItem onClick={() => onCopyLink(budget.public_id!)}>
                    <Copy className="h-4 w-4 mr-2" /> Copiar link
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {budget.version_group_id && onCompareVersions && (
                  <DropdownMenuItem onClick={() => onCompareVersions(budget.version_group_id!)}>
                    <GitCompare className="h-4 w-4 mr-2" /> Comparar versões
                  </DropdownMenuItem>
                )}
                {budget.internal_status !== "sent_to_client" && budget.internal_status !== "lost" && (
                  <DropdownMenuItem onClick={() => onMarkClosed(budget.id)}>
                    <Handshake className="h-4 w-4 mr-2 text-primary" /> Contrato Fechado
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onToggleOptionals(budget.id, budget.show_optional_items)}>
                  <ShoppingBag className="h-4 w-4 mr-2 text-amber-500" />
                  {budget.show_optional_items ? "Desativar opcionais" : "Incluir opcionais"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(budget.id)}>
                  <Copy className="h-4 w-4 mr-2" /> Duplicar como novo
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {budget.status !== "archived" && (
                  <DropdownMenuItem onClick={() => onArchive(budget.id)}>
                    <Archive className="h-4 w-4 mr-2" /> Arquivar
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(budget.id)}>
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Skeleton for loading state */
export function BudgetListSkeleton() {
  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="px-4 py-3.5 flex items-start gap-3">
          <div className="hidden sm:block h-10 w-10 rounded-lg bg-muted animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              <div className="h-4 w-16 bg-muted animate-pulse rounded-full" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-3 w-24 bg-muted animate-pulse rounded" />
              <div className="h-3 w-16 bg-muted animate-pulse rounded" />
            </div>
          </div>
          <div className="h-4 w-20 bg-muted animate-pulse rounded shrink-0 mt-1" />
        </div>
      ))}
    </div>
  );
}
