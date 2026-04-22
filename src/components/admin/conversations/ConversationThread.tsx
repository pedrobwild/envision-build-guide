import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Send, Loader2, ExternalLink, Paperclip, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  useConversationMessages,
  useSendDigisacMessage,
  type ConversationListItem,
} from "@/hooks/useConversations";

interface Props {
  conversation: ConversationListItem | null;
}

export function ConversationThread({ conversation }: Props) {
  const { data: messages, isLoading } = useConversationMessages(conversation?.id ?? null);
  const send = useSendDigisacMessage();
  const [text, setText] = useState("");
  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages?.length, conversation?.id]);

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center text-muted-foreground max-w-xs">
          <p className="text-sm font-medium">Selecione uma conversa</p>
          <p className="text-[11px] mt-1 font-body">
            As mensagens aparecerão aqui em tempo real.
          </p>
        </div>
      </div>
    );
  }

  const onSend = async () => {
    const body = text.trim();
    if (!body || !conversation) return;
    try {
      await send.mutateAsync({ conversationId: conversation.id, text: body });
      setText("");
    } catch (e) {
      toast({
        title: "Falha ao enviar",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/60 bg-card/30 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-display font-semibold tracking-tight truncate">
              {conversation.contact_name ?? conversation.contact_identifier ?? "Sem nome"}
            </h3>
            {conversation.channel && (
              <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                {conversation.channel}
              </Badge>
            )}
            {conversation.status && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[9px] h-4 px-1.5",
                  conversation.status === "open" || conversation.status === "active"
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                    : "",
                )}
              >
                {conversation.status}
              </Badge>
            )}
          </div>
          <p className="text-[10.5px] text-muted-foreground font-mono mt-0.5">
            {conversation.contact_identifier ?? "—"}
            {conversation.assigned_user_name && (
              <> · atendido por {conversation.assigned_user_name}</>
            )}
          </p>
        </div>
        {conversation.budget_id && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-[11px]"
            asChild
          >
            <a href={`/admin/budget/${conversation.budget_id}`}>
              <ExternalLink className="h-3 w-3" />
              Ver orçamento
            </a>
          </Button>
        )}
        {!conversation.budget_id && (
          <span className="text-[10px] text-muted-foreground font-body italic">
            <Link2 className="inline h-3 w-3 mr-1" />
            sem orçamento
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-muted/10">
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-2/3" />
            ))}
          </div>
        )}
        {!isLoading && (messages ?? []).length === 0 && (
          <div className="text-center text-muted-foreground text-[11px] font-body py-10">
            Nenhuma mensagem nesta conversa ainda.
          </div>
        )}
        {(messages ?? []).map((m) => {
          const out = m.direction === "out";
          const ts = m.sent_at ?? m.created_at;
          const attachments = Array.isArray(m.attachments) ? m.attachments : [];
          return (
            <div
              key={m.id}
              className={cn("flex", out ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[78%] rounded-xl px-3 py-2 shadow-sm",
                  out
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-card border border-border/60 rounded-bl-sm",
                )}
              >
                {!out && m.author_name && (
                  <p className="text-[10px] font-semibold mb-0.5 opacity-80">
                    {m.author_name}
                  </p>
                )}
                {m.body && (
                  <p className="text-[12.5px] font-body whitespace-pre-wrap break-words">
                    {m.body}
                  </p>
                )}
                {attachments.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    {attachments.map((a, idx) => {
                      const att = a as { url?: string; name?: string; mimetype?: string };
                      if (!att?.url) return null;
                      const isImage = att.mimetype?.startsWith("image/");
                      return isImage ? (
                        <a
                          key={idx}
                          href={att.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block"
                        >
                          <img
                            src={att.url}
                            alt={att.name ?? "attachment"}
                            className="max-h-48 rounded-md"
                          />
                        </a>
                      ) : (
                        <a
                          key={idx}
                          href={att.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-[11px] underline opacity-90"
                        >
                          <Paperclip className="h-3 w-3" />
                          {att.name ?? "anexo"}
                        </a>
                      );
                    })}
                  </div>
                )}
                <p
                  className={cn(
                    "text-[9px] mt-1 opacity-70",
                    out ? "text-right" : "text-left",
                  )}
                >
                  {ts ? format(new Date(ts), "dd/MM HH:mm", { locale: ptBR }) : ""}
                  {m.status && <span className="ml-1">· {m.status}</span>}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-border/60 bg-card/30 p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escreva uma mensagem... (Enter envia, Shift+Enter quebra linha)"
            className="min-h-[48px] max-h-32 text-[12.5px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
          />
          <Button
            onClick={onSend}
            disabled={!text.trim() || send.isPending}
            size="icon"
            className="h-9 w-9 shrink-0"
          >
            {send.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-[9.5px] text-muted-foreground font-body mt-1.5">
          Mensagens são enviadas via Digisac usando o canal original da conversa.
        </p>
      </div>
    </div>
  );
}
