import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plug, MessageCircle, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import DigisacConfigPanel from "@/components/admin/DigisacConfigPanel";
import { formatDate } from "@/lib/formatBRL";

interface MessageRow {
  id: string;
  body: string | null;
  direction: string | null;
  status: string | null;
  sent_at: string | null;
  created_at: string;
  author_name: string | null;
  conversation_id: string;
}

interface ConversationRow {
  id: string;
  contact_name: string | null;
  contact_identifier: string | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  unread_count: number;
  budget_id: string;
}

export default function DigisacPage() {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    void loadHistory();
  }, []);

  async function loadHistory() {
    setLoading(true);
    try {
      const [convRes, msgRes] = await Promise.all([
        supabase
          .from("budget_conversations")
          .select("id, contact_name, contact_identifier, last_message_preview, last_message_at, unread_count, budget_id")
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .limit(20),
        supabase
          .from("budget_conversation_messages")
          .select("id, body, direction, status, sent_at, created_at, author_name, conversation_id")
          .order("created_at", { ascending: false })
          .limit(30),
      ]);

      if (convRes.error) throw convRes.error;
      if (msgRes.error) throw msgRes.error;

      setConversations((convRes.data ?? []) as ConversationRow[]);
      setMessages((msgRes.data ?? []) as MessageRow[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar histórico.");
    } finally {
      setLoading(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("digisac-test-connection", {
        body: {},
      });
      if (error) throw error;
      if ((data as { ok?: boolean })?.ok) {
        toast.success("Conexão com Digisac OK!", {
          description: (data as { message?: string }).message ?? "Token válido.",
        });
      } else {
        toast.error("Falha ao conectar", {
          description: (data as { error?: string })?.error ?? "Verifique o token.",
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao testar conexão.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-primary" />
            Digisac (WhatsApp)
          </h1>
          <p className="text-sm text-muted-foreground font-body mt-1">
            Configurações da integração e histórico de mensagens enviadas/recebidas.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={testing}
            className="gap-2"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
            Testar conexão
          </Button>
          <Button variant="outline" size="sm" onClick={loadHistory} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Config */}
      <DigisacConfigPanel />

      {/* Histórico de conversas */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-display font-semibold text-foreground">
              Conversas recentes
            </h2>
            <Badge variant="outline">{conversations.length}</Badge>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-sm text-muted-foreground font-body py-4">
              Nenhuma conversa ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {conversations.map((c) => (
                <div
                  key={c.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-body font-medium text-sm text-foreground truncate">
                      {c.contact_name || c.contact_identifier || "Contato sem nome"}
                    </p>
                    <p className="text-xs text-muted-foreground font-body truncate mt-0.5">
                      {c.last_message_preview || "—"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {c.last_message_at && (
                      <p className="text-[11px] text-muted-foreground font-body">
                        {formatDate(c.last_message_at)}
                      </p>
                    )}
                    {c.unread_count > 0 && (
                      <Badge variant="default" className="mt-1 h-5 px-1.5 text-[10px]">
                        {c.unread_count}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Últimas mensagens */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-display font-semibold text-foreground">
              Últimas mensagens
            </h2>
            <Badge variant="outline">{messages.length}</Badge>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground font-body py-4">
              Nenhuma mensagem registrada.
            </p>
          ) : (
            <div className="space-y-2">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border"
                >
                  <div className="shrink-0 mt-0.5">
                    {m.direction === "out" ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : (
                      <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-body font-medium text-foreground">
                        {m.author_name || (m.direction === "out" ? "Sistema" : "Cliente")}
                      </span>
                      <Badge variant="outline" className="h-4 px-1 text-[10px]">
                        {m.direction === "out" ? "Enviada" : "Recebida"}
                      </Badge>
                      {m.status === "failed" && (
                        <Badge variant="destructive" className="h-4 px-1 text-[10px] gap-0.5">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Falhou
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-body text-foreground/90 mt-1 break-words">
                      {m.body || "(sem texto)"}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-body mt-1">
                      {formatDate(m.sent_at || m.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
