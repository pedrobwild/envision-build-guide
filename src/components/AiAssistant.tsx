import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  Paperclip,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useUserProfile } from "@/hooks/useUserProfile";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  ACCEPTED_MIME,
  MAX_FILES,
  MAX_FILE_BYTES,
  STORAGE_KEY,
  type Attachment,
  type Msg,
} from "./ai-assistant/types";
import {
  fileIconFor,
  formatBytes,
  looksLikeBulkCommand,
  readFileAsDataUrl,
  validateFinancialCommandFactor,
  validatePlanFactor,
} from "./ai-assistant/utils";
import { BulkOperationCard } from "./ai-assistant/BulkOperationCard";
import { useBulkOperations } from "./ai-assistant/useBulkOperations";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant-chat`;

export function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Msg[]) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { isAdmin } = useUserProfile();
  const { plan: planBulk, apply: applyBulk, revert: revertBulk, busyId } = useBulkOperations();

  // Persist slim history (no attachment payloads)
  useEffect(() => {
    try {
      const slim = messages.slice(-30).map((m) => ({
        role: m.role,
        content: m.content,
        attachments: m.attachments?.map((a) => ({
          name: a.name,
          mimeType: a.mimeType,
          size: a.size,
        })) as Attachment[] | undefined,
        bulkOp: m.bulkOp,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
    } catch {
      /* ignore quota */
    }
  }, [messages]);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, loading]);

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = MAX_FILES - pendingFiles.length;
    if (remaining <= 0) {
      toast({
        title: "Limite de anexos",
        description: `Máximo de ${MAX_FILES} arquivos por mensagem.`,
        variant: "destructive",
      });
      return;
    }
    const incoming = Array.from(files).slice(0, remaining);
    const next: Attachment[] = [];

    for (const file of incoming) {
      if (file.size > MAX_FILE_BYTES) {
        toast({
          title: "Arquivo muito grande",
          description: `${file.name} excede 20MB.`,
          variant: "destructive",
        });
        continue;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const mime = file.type || "application/octet-stream";
        const isImage = mime.startsWith("image/");
        const base64 = dataUrl.split(",")[1] ?? "";
        next.push({
          name: file.name,
          mimeType: mime,
          size: file.size,
          dataUrl: isImage ? dataUrl : undefined,
          base64: isImage ? undefined : base64,
        });
      } catch {
        toast({
          title: "Falha ao ler arquivo",
          description: file.name,
          variant: "destructive",
        });
      }
    }

    if (next.length > 0) setPendingFiles((prev) => [...prev, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePending = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // ---------- Bulk operations flow ----------
  const handleBulkCommand = async (command: string) => {
    const userMsg: Msg = { role: "user", content: command };

    // Defense in depth: re-check admin role before invoking the edge function.
    // The UI already gates entry to this flow via isAdmin, but we guarantee a
    // clear, friendly message even if state is stale or this path is reached
    // through a different entry point.
    if (!isAdmin) {
      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          role: "assistant",
          content:
            "🔒 **Operação restrita a administradores.**\n\n" +
            "Operações em lote (alterar valor, status, responsável de vários orçamentos de uma vez) só estão disponíveis para usuários com o papel **admin**.\n\n" +
            "Se você precisa executar essa ação, peça a um administrador ou solicite a elevação do seu acesso.",
        },
      ]);
      toast({
        title: "Sem permissão",
        description: "Apenas administradores podem executar operações em lote.",
        variant: "destructive",
      });
      setInput("");
      return;
    }

    // Pre-flight: if the command looks like a percentage adjustment, validate
    // the numeric factor BEFORE spending an LLM call. Catches "0%", "-5%",
    // ">100%" and missing/garbled numbers with a friendly inline message.
    const factorCheck = validateFinancialCommandFactor(command);
    if (factorCheck.kind === "invalid") {
      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          role: "assistant",
          content: `⚠️ **Não consegui validar o percentual.**\n\n${factorCheck.reason}`,
        },
      ]);
      toast({
        title: "Percentual inválido",
        description: factorCheck.reason,
        variant: "destructive",
      });
      setInput("");
      return;
    }

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await planBulk(command);
      if ("unsupported" in res) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              `Não consegui estruturar este comando.\n\n**${res.summary}**${res.reasoning ? `\n\n${res.reasoning}` : ""}`,
          },
        ]);
        return;
      }
      if ("empty" in res) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Nenhum orçamento foi encontrado para este filtro.\n\n_${res.summary}_`,
          },
        ]);
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "",
          bulkOp: { plan: res, status: "pending" },
        },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao planejar";
      toast({ title: "Erro no plano", description: msg, variant: "destructive" });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ ${msg}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkConfirm = async (msgIndex: number) => {
    const m = messages[msgIndex];
    const opId = m.bulkOp?.plan?.operation_id;
    if (!opId) return;

    // Estimate total work units. For financial adjustments the server iterates
    // over items (~60–80 per budget on average); for other action types it's
    // 1 unit per budget. We over-estimate slightly to avoid hitting 100% early.
    const applicableBudgets = m.bulkOp?.plan?.applicable_count ?? 0;
    const isFinancial = m.bulkOp?.plan?.action_type === "financial_adjustment";
    const estimatedTotal = Math.max(
      1,
      isFinancial ? applicableBudgets * 60 : applicableBudgets,
    );

    // Tuned to the server's parallel chunk size (24) and average chunk latency
    // (~350ms). Yields ~70 units/sec — capped at 95% until the apply resolves.
    const ratePerSecond = isFinancial ? 70 : 8;
    const startedAt = Date.now();

    setMessages((prev) =>
      prev.map((it, i) =>
        i === msgIndex && it.bulkOp
          ? {
              ...it,
              bulkOp: {
                ...it.bulkOp,
                progress: { processed: 0, total: estimatedTotal, estimated: true },
              },
            }
          : it,
      ),
    );

    const tick = () => {
      const elapsedSec = (Date.now() - startedAt) / 1000;
      const projected = Math.floor(elapsedSec * ratePerSecond);
      const capped = Math.min(projected, Math.floor(estimatedTotal * 0.95));
      setMessages((prev) =>
        prev.map((it, i) =>
          i === msgIndex && it.bulkOp && it.bulkOp.status === "pending"
            ? {
                ...it,
                bulkOp: {
                  ...it.bulkOp,
                  progress: { processed: capped, total: estimatedTotal, estimated: true },
                },
              }
            : it,
        ),
      );
    };
    const interval = window.setInterval(tick, 400);

    try {
      const res = await applyBulk(opId);
      const partial = res.partial_failures ?? 0;
      setMessages((prev) =>
        prev.map((it, i) =>
          i === msgIndex && it.bulkOp
            ? {
                ...it,
                bulkOp: {
                  ...it.bulkOp,
                  status: "applied",
                  appliedCount: res.applied_count,
                  partialFailures: partial,
                  progress: undefined,
                },
              }
            : it,
        ),
      );
      if (partial > 0) {
        toast({
          title: "Operação aplicada com avisos",
          description: `${res.applied_count} aplicadas · ${partial} falhas individuais. Verifique os logs.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Operação aplicada",
          description: `${res.applied_count} itens atualizados.`,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao aplicar";
      setMessages((prev) =>
        prev.map((it, i) =>
          i === msgIndex && it.bulkOp
            ? { ...it, bulkOp: { ...it.bulkOp, status: "failed", error: msg, progress: undefined } }
            : it,
        ),
      );
      toast({ title: "Erro ao aplicar", description: msg, variant: "destructive" });
    } finally {
      window.clearInterval(interval);
    }
  };

  const handleBulkRevert = async (msgIndex: number) => {
    const m = messages[msgIndex];
    const opId = m.bulkOp?.plan?.operation_id;
    if (!opId) return;
    try {
      await revertBulk(opId);
      setMessages((prev) =>
        prev.map((it, i) =>
          i === msgIndex && it.bulkOp
            ? { ...it, bulkOp: { ...it.bulkOp, status: "reverted" } }
            : it,
        ),
      );
      toast({ title: "Operação revertida", description: "Estado anterior restaurado." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao reverter";
      toast({ title: "Erro ao reverter", description: msg, variant: "destructive" });
    }
  };

  const handleBulkCancel = (msgIndex: number) => {
    setMessages((prev) => prev.filter((_, i) => i !== msgIndex));
  };

  // ---------- Standard chat flow ----------
  const sendMessage = async () => {
    const trimmed = input.trim();
    if ((!trimmed && pendingFiles.length === 0) || loading) return;

    // Detect admin-only batch commands
    if (pendingFiles.length === 0 && trimmed && looksLikeBulkCommand(trimmed)) {
      if (!isAdmin) {
        setMessages((prev) => [
          ...prev,
          { role: "user", content: trimmed },
          {
            role: "assistant",
            content:
              "🔒 **Operação restrita a administradores.**\n\n" +
              "Esse comando parece ser uma operação em lote (alterar valor, status, responsável de vários orçamentos). Apenas usuários com papel **admin** podem executá-las.\n\n" +
              "Se precisar dessa ação, peça a um administrador ou solicite elevação do seu acesso.",
          },
        ]);
        toast({
          title: "Sem permissão",
          description: "Apenas administradores podem executar operações em lote.",
          variant: "destructive",
        });
        setInput("");
        return;
      }
      await handleBulkCommand(trimmed);
      return;
    }

    const userMsg: Msg = {
      role: "user",
      content: trimmed || (pendingFiles.length > 0 ? "Analise os arquivos anexados." : ""),
      attachments: pendingFiles.length > 0 ? pendingFiles : undefined,
    };

    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setPendingFiles([]);
    setLoading(true);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.bulkOp) {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m,
          );
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: next }),
      });

      if (!resp.ok || !resp.body) {
        const errBody = await resp.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;

      while (!done) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) upsertAssistant(delta);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Falha ao enviar mensagem";
      toast({ title: "Erro no assistente", description: message, variant: "destructive" });
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.content && !last.bulkOp) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearHistory = () => {
    setMessages([]);
    setPendingFiles([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const suggestions = isAdmin
    ? [
        "Reduzir 5% nos orçamentos criados a partir de 01/01/2026",
        "Mover para 'aguardando' os orçamentos criados desde 01/03/2026",
        "Atribuir o orçamentista João aos orçamentos criados desde 15/04/2026",
      ]
    : [
        "Como melhorar a taxa de conversão do pipeline?",
        "Resuma este orçamento e gere um checklist",
        "Escreva uma mensagem de follow-up para WhatsApp",
      ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir assistente de IA"
        className={cn(
          "fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40",
          "h-14 w-14 rounded-full shadow-lg",
          "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground",
          "flex items-center justify-center",
          "hover:scale-105 active:scale-95 transition-transform",
          "ring-2 ring-background",
        )}
      >
        <Sparkles className="h-6 w-6" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md flex flex-col p-0 gap-0"
        >
          <SheetHeader className="px-4 py-3 border-b border-border/60 shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2 text-base font-display">
                <Sparkles className="h-4 w-4 text-primary" />
                Assistente BWild
              </SheetTitle>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearHistory}
                    title="Limpar conversa"
                    className="h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setOpen(false)}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div ref={scrollRef} className="px-4 py-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-12 space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Olá! Como posso ajudar?
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto font-body">
                      {isAdmin
                        ? "Pergunte, anexe um arquivo ou peça uma operação em lote (ex.: reduzir 10% em orçamentos a partir de DD/MM)."
                        : "Pergunte ou anexe um arquivo (PDF, imagem, planilha, áudio, Word) para análise."}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 max-w-xs mx-auto pt-2">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => setInput(s)}
                        className="text-left text-xs px-3 py-2 rounded-lg bg-muted/60 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => {
                if (m.bulkOp) {
                  return (
                    <div key={i} className="flex justify-start">
                      <div className="w-full max-w-[95%]">
                        <BulkOperationCard
                          plan={m.bulkOp.plan}
                          status={m.bulkOp.status}
                          appliedCount={m.bulkOp.appliedCount}
                          partialFailures={m.bulkOp.partialFailures}
                          error={m.bulkOp.error}
                          busy={busyId === m.bulkOp.plan?.operation_id}
                          progress={m.bulkOp.progress}
                          onConfirm={() => handleBulkConfirm(i)}
                          onCancel={() => handleBulkCancel(i)}
                          onRevert={() => handleBulkRevert(i)}
                        />
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={i}
                    className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
                        m.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted text-foreground rounded-bl-sm",
                      )}
                    >
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="mb-2 space-y-1.5">
                          {m.attachments.map((att, idx) => {
                            const Icon = fileIconFor(att.mimeType, att.name);
                            return att.dataUrl ? (
                              <img
                                key={idx}
                                src={att.dataUrl}
                                alt={att.name}
                                className="max-h-40 w-full object-cover rounded-lg border border-border/40"
                              />
                            ) : (
                              <div
                                key={idx}
                                className={cn(
                                  "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs",
                                  m.role === "user"
                                    ? "bg-primary-foreground/15"
                                    : "bg-background/60 border border-border/50",
                                )}
                              >
                                <Icon className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate flex-1">{att.name}</span>
                                <span className="opacity-70 shrink-0">{formatBytes(att.size)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {m.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none font-body prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-pre:my-2 prose-headings:mb-1 prose-headings:mt-2">
                          <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                        </div>
                      ) : (
                        m.content && <p className="whitespace-pre-wrap font-body">{m.content}</p>
                      )}
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="border-t border-border/60 p-3 shrink-0 space-y-2">
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {pendingFiles.map((att, idx) => {
                  const Icon = fileIconFor(att.mimeType, att.name);
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-md bg-muted text-xs max-w-[200px]"
                    >
                      <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="truncate font-body">{att.name}</span>
                      <span className="text-muted-foreground shrink-0">
                        {formatBytes(att.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removePending(idx)}
                        className="ml-0.5 p-0.5 rounded hover:bg-background/80 text-muted-foreground hover:text-foreground"
                        aria-label={`Remover ${att.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_MIME}
                onChange={(e) => handleFilesSelected(e.target.files)}
                className="hidden"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || pendingFiles.length >= MAX_FILES}
                title="Anexar arquivos (PDF, imagem, planilha, áudio, Word)"
                className="shrink-0 h-10 w-10"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  pendingFiles.length > 0
                    ? "O que você quer saber sobre esses arquivos?"
                    : isAdmin
                      ? "Pergunte ou peça uma operação em lote..."
                      : "Pergunte alguma coisa..."
                }
                rows={1}
                className="resize-none min-h-[40px] max-h-32 text-sm font-body"
                disabled={loading}
              />
              <Button
                onClick={sendMessage}
                disabled={loading || (!input.trim() && pendingFiles.length === 0)}
                size="icon"
                className="shrink-0 h-10 w-10"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center font-body">
              Enter envia · Shift+Enter quebra linha · até {MAX_FILES} arquivos de 20MB
              {isAdmin && " · Comandos em lote ativos"}
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
