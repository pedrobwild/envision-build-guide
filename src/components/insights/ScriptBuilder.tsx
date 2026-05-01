import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Loader2, Copy, Check, Brain } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { InsightsDashboardData } from "@/types/insights-dashboard";

import { logger } from "@/lib/logger";

interface ProfileOption {
  type: string;
  description: string;
  frequency: string;
  approachStrategy: string;
  pitfalls: string;
}

interface ScriptBuilderProps {
  profiles: ProfileOption[];
  dashboardData: InsightsDashboardData | null | undefined;
}

export default function ScriptBuilder({ profiles, dashboardData }: ScriptBuilderProps) {
  const [open, setOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<ProfileOption | null>(null);
  const [script, setScript] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const abortRef = useRef<AbortController | null>(null);

  const generateScript = async (profile: ProfileOption) => {
    setSelectedProfile(profile);
    setScript("");
    setLoading(true);
    setOpen(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Usa a sessão autenticada — o gateway exige JWT válido.
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-script`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          profileType: profile.type,
          profileData: profile,
          dashboardContext: {
            objections: dashboardData?.objections,
            hiddenObjections: dashboardData?.hiddenObjections,
            closingArguments: dashboardData?.closingArguments,
            buyingSignals: dashboardData?.buyingSignals,
            topQuestions: dashboardData?.topQuestions,
            buyerPersona: dashboardData?.buyerPersona,
          },
        }),
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({}));
        const friendly =
          resp.status === 429
            ? "Muitas solicitações. Aguarde alguns instantes e tente novamente."
            : resp.status === 402
              ? "Sem créditos suficientes para gerar o roteiro. Adicione créditos em Configurações."
              : errData.error || `Erro ${resp.status}`;
        throw new Error(friendly);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              accumulated += content;
              setScript(accumulated);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      logger.error("Script generation error:", err);
      toast({
        title: "Erro ao gerar roteiro",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(script);
    setCopied(true);
    toast({ title: "Roteiro copiado!", description: "Cole no WhatsApp ou email para o consultor." });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    abortRef.current?.abort();
    setOpen(false);
  };

  if (!profiles?.length) return null;

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Gerar Roteiro de Reunião</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Selecione o perfil do cliente para gerar um script personalizado para o consultor:
        </p>
        <div className="flex flex-wrap gap-2">
          {profiles.map((p) => (
            <Button
              key={p.type}
              variant="outline"
              size="sm"
              onClick={() => generateScript(p)}
              disabled={loading}
              className="gap-1.5"
            >
              <Brain className="h-3.5 w-3.5" />
              {p.type}
            </Button>
          ))}
        </div>
      </div>

      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/60 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Roteiro de Reunião
                </SheetTitle>
                <SheetDescription className="text-xs mt-1">
                  Personalizado para perfil: <Badge variant="secondary" className="ml-1 text-xs">{selectedProfile?.type}</Badge>
                </SheetDescription>
              </div>
              {script && !loading && (
                <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 shrink-0">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              )}
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1 px-6 py-4">
            {loading && !script && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Gerando roteiro personalizado…</p>
              </div>
            )}

            {script && (
              <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-headings:font-semibold prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground">
                <ScriptMarkdown content={script} />
                {loading && (
                  <span className="inline-block w-2 h-4 bg-primary/60 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
                )}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Minimal markdown renderer for the script */
function ScriptMarkdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: JSX.Element[] = [];

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-base font-bold mt-6 mb-2 text-foreground border-b border-border/40 pb-1">
          {trimmed.slice(3)}
        </h2>
      );
    } else if (trimmed.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-sm font-semibold mt-4 mb-1.5 text-foreground">
          {trimmed.slice(4)}
        </h3>
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <li key={i} className="text-sm text-muted-foreground ml-4 mb-1 list-disc">
          {formatInline(trimmed.slice(2))}
        </li>
      );
    } else if (trimmed.startsWith("> ")) {
      elements.push(
        <blockquote key={i} className="border-l-2 border-primary/30 pl-3 my-2 text-sm italic text-muted-foreground">
          {formatInline(trimmed.slice(2))}
        </blockquote>
      );
    } else if (trimmed === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <p key={i} className="text-sm text-muted-foreground leading-relaxed mb-1.5">
          {formatInline(trimmed)}
        </p>
      );
    }
  });

  return <>{elements}</>;
}

function formatInline(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <strong key={match.index} className="font-semibold text-foreground">
        {match[1]}
      </strong>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}
