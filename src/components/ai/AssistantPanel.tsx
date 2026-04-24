// =============================================================================
// AssistantPanel — painel lateral (Sheet) com chat do Assistente BWild.
// =============================================================================

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, Send, Square, Sparkles, Wrench, Globe, RefreshCw } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAssistant } from "@/hooks/useAssistant";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Como está o pipeline de orçamentos dos últimos 30 dias?",
  "Quais clientes fecharam mais obras este trimestre?",
  "Qual o ticket médio aprovado nos últimos 90 dias?",
  "Tendências do mercado de construção civil em 2026",
  "Compare nossa margem com benchmarks do setor",
];

interface AssistantPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssistantPanel({ open, onOpenChange }: AssistantPanelProps) {
  const [input, setInput] = useState("");
  const [allowMarket, setAllowMarket] = useState(true);
  const {
    messages,
    send,
    stop,
    reset,
    isStreaming,
    toolEvents,
    error,
  } = useAssistant();

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, toolEvents]);

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    await send(text, { allowMarketSearch: allowMarket });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl flex flex-col p-0 gap-0"
      >
        <SheetHeader className="px-5 py-4 border-b border-border/50">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="size-4 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-base">Assistente BWild</SheetTitle>
                <SheetDescription className="text-xs">
                  Responde sobre seu sistema e o mercado
                </SheetDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              disabled={isStreaming}
              className="text-xs"
            >
              <RefreshCw className="size-3 mr-1" />
              Nova
            </Button>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setAllowMarket((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors",
                allowMarket
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "border-border/50 text-muted-foreground hover:bg-muted",
              )}
            >
              <Globe className="size-3" />
              Busca de mercado {allowMarket ? "ativada" : "desativada"}
            </button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-5">
          <div ref={scrollRef} className="py-4 space-y-4">
            {messages.length === 0 && (
              <EmptyState onPick={(s) => setInput(s)} />
            )}

            {messages.map((m) => (
              <MessageBubble key={m.id} role={m.role} content={m.content} streaming={m.streaming} citations={m.citations} />
            ))}

            {isStreaming && toolEvents.length > 0 && (
              <ToolTimeline events={toolEvents.slice(-4)} />
            )}

            {error && (
              <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                {error}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t border-border/50 p-3">
          <div className="relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Pergunte sobre orçamentos, clientes, operações ou mercado…"
              rows={2}
              className="pr-20 resize-none"
              disabled={isStreaming}
            />
            <div className="absolute right-2 bottom-2 flex gap-1">
              {isStreaming ? (
                <Button size="sm" variant="secondary" onClick={stop}>
                  <Square className="size-3 mr-1" />
                  Parar
                </Button>
              ) : (
                <Button size="sm" onClick={handleSubmit} disabled={!input.trim()}>
                  <Send className="size-3 mr-1" />
                  Enviar
                </Button>
              )}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 px-1">
            Enter envia · Shift+Enter quebra linha
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="text-center py-8 space-y-3">
      <div className="mx-auto size-12 rounded-full bg-primary/10 flex items-center justify-center">
        <Bot className="size-6 text-primary" />
      </div>
      <div>
        <h3 className="text-sm font-semibold">Olá, como posso ajudar?</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Responde sobre dados do seu sistema e inteligência de mercado.
        </p>
      </div>
      <div className="flex flex-col gap-1.5 mt-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="text-left text-xs px-3 py-2 rounded-md border border-border/50 hover:bg-muted/60 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  role,
  content,
  streaming,
  citations,
}: {
  role: string;
  content: string;
  streaming?: boolean;
  citations?: Array<{ title?: string; url?: string }> | null;
}) {
  const isUser = role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted/70 text-foreground border border-border/40",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-headings:my-2">
            <ReactMarkdown>{content || (streaming ? "…" : "")}</ReactMarkdown>
            {streaming && (
              <span className="inline-block size-2 rounded-full bg-primary/70 animate-pulse ml-1" />
            )}
          </div>
        )}
        {citations && citations.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/30 space-y-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Fontes
            </p>
            {citations.slice(0, 5).map((c, i) => (
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
  );
}

function ToolTimeline({ events }: { events: { name: string; args?: any; preview?: string; at: number }[] }) {
  return (
    <div className="space-y-1.5 pl-1">
      {events.map((e, i) => (
        <div key={i} className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Wrench className="size-3" />
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
            {e.name}
          </Badge>
          {e.preview ? (
            <span className="truncate">→ {e.preview.slice(0, 80)}</span>
          ) : (
            <span className="italic">executando…</span>
          )}
        </div>
      ))}
    </div>
  );
}
