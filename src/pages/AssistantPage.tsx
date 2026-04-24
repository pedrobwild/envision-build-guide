// =============================================================================
// AssistantPage — página dedicada do Assistente BWild com histórico de conversas.
// =============================================================================

import { useEffect, useState } from "react";
import { Plus, Clock, Sparkles, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAssistant } from "@/hooks/useAssistant";
import { cn } from "@/lib/utils";

import {
  formatDistanceToNow,
} from "date-fns";
import { ptBR } from "date-fns/locale";

// Reaproveita subcomponentes visuais do painel
import ReactMarkdown from "react-markdown";
import { Textarea } from "@/components/ui/textarea";
import { Send, Square } from "lucide-react";

interface ConversationRow {
  id: string;
  title: string;
  updated_at: string;
  pinned: boolean;
}

export default function AssistantPage() {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [input, setInput] = useState("");

  const {
    messages,
    conversationId,
    isStreaming,
    send,
    stop,
    reset,
    loadConversation,
  } = useAssistant();

  const refreshList = async () => {
    setLoadingList(true);
    const { data } = await supabase
      .from("ai_conversations")
      .select("id, title, updated_at, pinned")
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(40);
    setConversations((data as ConversationRow[]) ?? []);
    setLoadingList(false);
  };

  useEffect(() => {
    refreshList();
  }, []);

  useEffect(() => {
    if (!isStreaming && conversationId) refreshList();
  }, [isStreaming, conversationId]);

  const handleSend = async () => {
    const t = input.trim();
    if (!t) return;
    setInput("");
    await send(t);
  };

  const handleNew = () => {
    reset();
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4 px-4 py-4">
      {/* Sidebar de conversas */}
      <aside className="hidden md:flex flex-col w-72 shrink-0 border rounded-xl bg-card/50">
        <div className="flex items-center justify-between px-3 py-2.5 border-b">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> Conversas
          </h2>
          <Button size="sm" variant="outline" onClick={handleNew}>
            <Plus className="size-3 mr-1" /> Nova
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loadingList && (
              <p className="text-xs text-muted-foreground px-2 py-3">
                Carregando…
              </p>
            )}
            {!loadingList && conversations.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-3">
                Nenhuma conversa ainda.
              </p>
            )}
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => loadConversation(c.id)}
                className={cn(
                  "w-full text-left rounded-md px-2.5 py-2 text-xs hover:bg-muted transition-colors",
                  conversationId === c.id && "bg-muted",
                )}
              >
                <p className="font-medium truncate">{c.title || "Sem título"}</p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="size-2.5" />
                  {formatDistanceToNow(new Date(c.updated_at), {
                    locale: ptBR,
                    addSuffix: true,
                  })}
                </p>
              </button>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Chat principal */}
      <section className="flex-1 flex flex-col border rounded-xl bg-card/50 min-w-0">
        <header className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="size-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Assistente BWild</h1>
              <p className="text-[11px] text-muted-foreground">
                Dados internos + inteligência de mercado
              </p>
            </div>
          </div>
        </header>

        <ScrollArea className="flex-1 px-6">
          <div className="py-6 space-y-4 max-w-3xl mx-auto">
            {messages.length === 0 && (
              <div className="text-center py-16">
                <div className="mx-auto size-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <MessageSquare className="size-7 text-primary" />
                </div>
                <h2 className="text-base font-semibold">
                  Como posso ajudar hoje?
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Pergunte sobre orçamentos, clientes, operações ou o mercado.
                </p>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex",
                  m.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/70 border border-border/40",
                  )}
                >
                  {m.role === "user" ? (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>
                        {m.content || (m.streaming ? "…" : "")}
                      </ReactMarkdown>
                    </div>
                  )}
                  {m.citations && m.citations.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/30 space-y-1">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Fontes
                      </p>
                      {m.citations.slice(0, 6).map((c, i) => (
                        <a
                          key={i}
                          href={c.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-xs text-primary hover:underline truncate"
                        >
                          {c.title || c.url}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="border-t p-3">
          <div className="relative max-w-3xl mx-auto">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Pergunte algo…"
              rows={2}
              disabled={isStreaming}
              className="pr-24 resize-none"
            />
            <div className="absolute right-2 bottom-2">
              {isStreaming ? (
                <Button size="sm" variant="secondary" onClick={stop}>
                  <Square className="size-3 mr-1" /> Parar
                </Button>
              ) : (
                <Button size="sm" onClick={handleSend} disabled={!input.trim()}>
                  <Send className="size-3 mr-1" /> Enviar
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
