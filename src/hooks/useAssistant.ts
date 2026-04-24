// =============================================================================
// useAssistant — hook React para conversar com a edge function ai-assistant
// via streaming SSE (fetch + ReadableStream). Mantém estado de mensagens,
// tool calls em execução e citações.
// =============================================================================

import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AssistantRole = "user" | "assistant" | "tool" | "system";

export interface AssistantMessage {
  id: string;
  role: AssistantRole;
  content: string;
  toolName?: string;
  citations?: Array<{ title?: string; url?: string }> | null;
  streaming?: boolean;
}

export interface ToolEvent {
  name: string;
  args?: Record<string, unknown>;
  preview?: string;
  at: number;
}

interface UseAssistantOptions {
  initialConversationId?: string | null;
  onConversationId?: (id: string) => void;
}

const FUNCTION_NAME = "ai-assistant";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function useAssistant(opts: UseAssistantOptions = {}) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(
    opts.initialConversationId ?? null,
  );
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setConversationId(null);
    setToolEvents([]);
    setError(null);
    setIsStreaming(false);
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    setConversationId(id);
    const { data, error: err } = await supabase
      .from("ai_messages")
      .select("id, role, content, tool_name, citations, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });
    if (err) {
      setError(err.message);
      return;
    }
    setMessages(
      (data ?? []).map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        toolName: m.tool_name ?? undefined,
        citations: m.citations ?? null,
      })),
    );
  }, []);

  const send = useCallback(
    async (text: string, options?: { allowMarketSearch?: boolean }) => {
      if (!text.trim() || isStreaming) return;
      setError(null);
      setIsStreaming(true);

      const userMsg: AssistantMessage = {
        id: uid(),
        role: "user",
        content: text.trim(),
      };
      const assistantMsg: AssistantMessage = {
        id: uid(),
        role: "assistant",
        content: "",
        streaming: true,
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (!token) throw new Error("Sessão expirada. Faça login novamente.");

        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${FUNCTION_NAME}`;
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            conversationId,
            message: text.trim(),
            allowMarketSearch: options?.allowMarketSearch ?? true,
          }),
          signal: controller.signal,
        });

        if (!resp.ok || !resp.body) {
          const errText = await resp.text().catch(() => "");
          throw new Error(`Falha (${resp.status}): ${errText.slice(0, 200)}`);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const ev of events) {
            const lines = ev.split("\n");
            const eventLine = lines.find((l) => l.startsWith("event:"));
            const dataLine = lines.find((l) => l.startsWith("data:"));
            if (!eventLine || !dataLine) continue;
            const eventName = eventLine.slice(6).trim();
            let data: any = {};
            try {
              data = JSON.parse(dataLine.slice(5).trim());
            } catch {
              continue;
            }

            if (eventName === "meta" && data.conversationId) {
              setConversationId(data.conversationId);
              opts.onConversationId?.(data.conversationId);
            } else if (eventName === "delta" && typeof data.text === "string") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, content: m.content + data.text }
                    : m,
                ),
              );
            } else if (eventName === "tool") {
              setToolEvents((prev) => [
                ...prev,
                { name: data.name, args: data.args, at: Date.now() },
              ]);
            } else if (eventName === "tool_result") {
              setToolEvents((prev) => [
                ...prev,
                { name: data.name, preview: data.preview, at: Date.now() },
              ]);
            } else if (eventName === "done") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, streaming: false, citations: data.citations ?? null }
                    : m,
                ),
              );
            } else if (eventName === "error") {
              throw new Error(data.message || "Erro no assistente");
            }
          }
        }
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? {
                  ...m,
                  streaming: false,
                  content:
                    m.content ||
                    `⚠️ Não foi possível gerar resposta.\n\n${msg}`,
                }
              : m,
          ),
        );
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [conversationId, isStreaming, opts],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return {
    messages,
    conversationId,
    isStreaming,
    error,
    toolEvents,
    send,
    stop,
    reset,
    loadConversation,
    setMessages,
  };
}
