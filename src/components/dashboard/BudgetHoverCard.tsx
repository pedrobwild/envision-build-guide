import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { INTERNAL_STATUSES, type InternalStatus } from "@/lib/role-constants";
import { formatBRL } from "@/lib/formatBRL";
import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Clock, User, Hammer, Eye, Globe, AlertTriangle, Calendar,
} from "lucide-react";

interface BudgetHoverCardProps {
  budget: any;
  profiles: Record<string, string>;
  children: React.ReactNode;
}

export function BudgetHoverCard({ budget: b, profiles, children }: BudgetHoverCardProps) {
  const statusConfig = INTERNAL_STATUSES[b.internal_status as InternalStatus];
  const isOverdue = b.due_at && new Date(b.due_at) < new Date() && !["contrato_fechado", "lost", "archived"].includes(b.internal_status);
  const isPublished = b.status === "published" && b.public_id;
  const total = getBudgetTotalQuick(b);
  const lastUpdate = b.updated_at ? formatDistanceToNow(new Date(b.updated_at), { addSuffix: true, locale: ptBR }) : null;
  const createdDate = b.created_at ? format(new Date(b.created_at), "dd MMM yyyy", { locale: ptBR }) : null;
  const daysSinceUpdate = b.updated_at ? Math.floor((Date.now() - new Date(b.updated_at).getTime()) / (1000 * 60 * 60 * 24)) : null;
  const isStalled = daysSinceUpdate !== null && daysSinceUpdate > 5;

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="start"
        sideOffset={12}
        className="w-72 p-0 border-border"
      >
        {/* Header */}
        <div className="px-4 pt-3 pb-2 border-b border-border/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-body font-semibold text-foreground truncate max-w-[180px]">
              {b.project_name || "Sem nome"}
            </span>
            {b.sequential_code && (
              <span className="text-[9px] font-mono tabular-nums text-muted-foreground/50">
                {b.sequential_code}
              </span>
            )}
          </div>
          <p className="text-[11px] font-body text-muted-foreground truncate">
            {b.client_name}
          </p>
        </div>

        {/* Status bar */}
        <div className="px-4 py-2 flex items-center gap-2 border-b border-border/50">
          {statusConfig && (
            <span className="text-[9px] font-body font-medium text-muted-foreground bg-muted/80 px-1.5 py-0.5 rounded">
              {statusConfig.icon} {statusConfig.label}
            </span>
          )}
          {isOverdue && (
            <span className="text-[9px] font-body font-semibold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <AlertTriangle className="h-2.5 w-2.5" /> Atrasado
            </span>
          )}
          {isPublished && (
            <span className="text-[9px] font-body font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <Globe className="h-2.5 w-2.5" /> Publicado
            </span>
          )}
          {isStalled && !isOverdue && (
            <span className="text-[9px] font-body font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
              Parado há {daysSinceUpdate}d
            </span>
          )}
        </div>

        {/* Details */}
        <div className="px-4 py-2.5 space-y-2">
          {/* Value */}
          {total > 0 && (
            <DetailRow icon={null} label="Valor" value={formatBRL(total)} mono />
          )}

          {/* Estimator */}
          {b.estimator_owner_id && profiles[b.estimator_owner_id] && (
            <DetailRow icon={<Hammer className="h-3 w-3" />} label="Orçamentista" value={profiles[b.estimator_owner_id]} />
          )}

          {/* Commercial */}
          {b.commercial_owner_id && profiles[b.commercial_owner_id] && (
            <DetailRow icon={<User className="h-3 w-3" />} label="Comercial" value={profiles[b.commercial_owner_id]} />
          )}

          {/* Due date */}
          {b.due_at && (
            <DetailRow
              icon={<Calendar className="h-3 w-3" />}
              label="Prazo"
              value={format(new Date(b.due_at), "dd/MM/yyyy")}
              alert={isOverdue}
            />
          )}

          {/* Views */}
          {b.view_count > 0 && (
            <DetailRow icon={<Eye className="h-3 w-3" />} label="Visualizações" value={String(b.view_count)} mono />
          )}

          {/* Version */}
          {(b.version_number ?? 1) > 1 && (
            <DetailRow icon={null} label="Versão" value={`v${b.version_number}`} mono />
          )}

          {/* Location */}
          {(b.bairro || b.condominio) && (
            <DetailRow icon={null} label="Local" value={[b.condominio, b.bairro].filter(Boolean).join(", ")} />
          )}
        </div>

        {/* Footer */}
        {lastUpdate && (
          <div className="px-4 py-2 border-t border-border/50">
            <div className="flex items-center gap-1.5">
              <Clock className="h-2.5 w-2.5 text-muted-foreground/40" />
              <span className="text-[9px] font-body text-muted-foreground/50">
                Atualizado {lastUpdate}
              </span>
              {createdDate && (
                <>
                  <span className="text-[9px] text-muted-foreground/30">·</span>
                  <span className="text-[9px] font-body text-muted-foreground/50">
                    Criado em {createdDate}
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

function DetailRow({
  icon,
  label,
  value,
  mono,
  alert,
}: {
  icon: React.ReactNode | null;
  label: string;
  value: string;
  mono?: boolean;
  alert?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-muted-foreground/50">{icon}</span>}
        <span className="text-[10px] font-body text-muted-foreground">{label}</span>
      </div>
      <span className={`text-[11px] font-body font-medium truncate max-w-[140px] ${
        mono ? "font-mono tabular-nums" : ""
      } ${alert ? "text-destructive" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}

function getBudgetTotalQuick(b: any): number {
  const sectionsTotal = (b.sections || []).reduce(
    (sum: number, s: any) => sum + calculateSectionSubtotal(s),
    0
  );
  const adjustmentsTotal = (b.adjustments || []).reduce(
    (sum: number, adj: any) => sum + adj.sign * Number(adj.amount),
    0
  );
  return sectionsTotal + adjustmentsTotal;
}
