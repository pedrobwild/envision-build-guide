import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, MessageCircle, Circle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ConversationListItem } from "@/hooks/useConversations";

interface Props {
  conversations: ConversationListItem[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export function ConversationList({
  conversations,
  isLoading,
  selectedId,
  onSelect,
  search,
  onSearchChange,
}: Props) {
  const grouped = useMemo(() => conversations, [conversations]);

  return (
    <div className="flex flex-col h-full border-r border-border/60 bg-card/40">
      <div className="p-3 border-b border-border/60">
        <div className="flex items-center gap-2 mb-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-display font-semibold tracking-tight">Conversas</h2>
          <span className="ml-auto text-[10px] text-muted-foreground font-mono">
            {conversations.length}
          </span>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar contato..."
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-3 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        )}
        {!isLoading && grouped.length === 0 && (
          <div className="p-6 text-center text-[11px] text-muted-foreground font-body">
            Nenhuma conversa ainda. Sincronize o Digisac para importar tickets.
          </div>
        )}
        {!isLoading &&
          grouped.map((c) => (
            <ConversationRow
              key={c.id}
              item={c}
              active={c.id === selectedId}
              onClick={() => onSelect(c.id)}
            />
          ))}
      </div>
    </div>
  );
}

function ConversationRow({
  item,
  active,
  onClick,
}: {
  item: ConversationListItem;
  active: boolean;
  onClick: () => void;
}) {
  const when = item.last_message_at
    ? formatDistanceToNow(new Date(item.last_message_at), { locale: ptBR, addSuffix: false })
    : "";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-2.5 border-b border-border/40 transition-colors flex gap-2.5",
        active ? "bg-primary/10" : "hover:bg-muted/40",
      )}
    >
      <div className="relative shrink-0">
        {item.avatar_url ? (
          <img
            src={item.avatar_url}
            alt={item.contact_name ?? "avatar"}
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-[11px] font-semibold text-primary-foreground">
            {initials(item.contact_name ?? item.contact_identifier ?? "")}
          </div>
        )}
        {item.unread_count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-emerald-500 text-[9px] text-white font-semibold flex items-center justify-center">
            {item.unread_count}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="text-[12.5px] font-medium truncate flex-1">
            {item.contact_name ?? item.contact_identifier ?? "Sem nome"}
          </p>
          {when && (
            <span className="text-[9.5px] text-muted-foreground shrink-0">{when}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {item.channel && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wider">
              {item.channel}
            </span>
          )}
          {item.status && (
            <span
              className={cn(
                "text-[9px] px-1 py-0.5 rounded flex items-center gap-1",
                item.status === "open" || item.status === "active"
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <Circle className="h-1.5 w-1.5 fill-current" />
              {item.status}
            </span>
          )}
          {item.budget_id && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary">
              orçamento
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
          {item.last_message_preview ?? "—"}
        </p>
      </div>
    </button>
  );
}
