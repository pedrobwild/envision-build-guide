import { useMemo, useState } from "react";
import { MessageCircle, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  useConversations,
  useSyncDigisac,
  useDigisacConfig,
  type ConversationListItem,
} from "@/hooks/useConversations";
import { ConversationList } from "@/components/admin/conversations/ConversationList";
import { ConversationThread } from "@/components/admin/conversations/ConversationThread";
import { DigisacSettingsDialog } from "@/components/admin/conversations/DigisacSettingsDialog";

export default function ConversationsPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: conversations, isLoading, refetch, isFetching } = useConversations({ search });
  const { data: cfg } = useDigisacConfig();
  const sync = useSyncDigisac();
  const { toast } = useToast();

  const selected = useMemo<ConversationListItem | null>(() => {
    if (!selectedId || !conversations) return null;
    return conversations.find((c) => c.id === selectedId) ?? null;
  }, [conversations, selectedId]);

  const configured = !!cfg?.api_token;

  const onSync = async () => {
    try {
      const result = await sync.mutateAsync({ limit: 100, messages_per_ticket: 30 });
      toast({
        title: "Sincronização concluída",
        description: `${result.tickets} tickets e ${result.messages} mensagens importadas.`,
      });
    } catch (e) {
      toast({
        title: "Erro na sincronização",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] lg:h-[calc(100vh-6rem)] flex flex-col">
      <div className="px-4 py-2.5 border-b border-border/60 bg-card/40 flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-primary" />
        <h1 className="text-sm font-display font-semibold tracking-tight">
          Conversas (Digisac)
        </h1>
        <p className="text-[10.5px] text-muted-foreground font-body ml-2 hidden md:block">
          Histórico omnichannel vinculado aos orçamentos
        </p>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={onSync}
            disabled={!configured || sync.isPending}
          >
            {sync.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Sincronizar
          </Button>
          <DigisacSettingsDialog />
        </div>
      </div>

      {!configured && (
        <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/30 text-amber-700 dark:text-amber-400 text-[11.5px] font-body">
          Digisac ainda não está configurado. Clique em "Configurar Digisac" e
          informe o token da API para começar a sincronizar conversas.
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 md:grid-cols-[340px_1fr] min-h-0">
        <ConversationList
          conversations={conversations ?? []}
          isLoading={isLoading || isFetching}
          selectedId={selectedId}
          onSelect={setSelectedId}
          search={search}
          onSearchChange={setSearch}
        />
        <ConversationThread conversation={selected} />
      </div>
    </div>
  );
}
