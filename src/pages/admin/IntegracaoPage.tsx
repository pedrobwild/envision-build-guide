import { useEffect, useMemo, useState } from "react";
import {
  Plug,
  KeyRound,
  Webhook,
  Copy,
  Check,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  Eye,
  EyeOff,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Power,
  PowerOff,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
// Tabelas/RPCs ainda não presentes nos tipos gerados (personal_access_tokens,
// integration_webhooks, create_/revoke_personal_access_token). Usamos um alias
// tipado como `any` apenas nessas chamadas para destravar o build sem perder
// segurança nas demais consultas do projeto.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import { useConfirm } from "@/hooks/useConfirm";
import { logger } from "@/lib/logger";
import { formatDate } from "@/lib/formatBRL";

/* ────────────────────────────────────────────────────────────────────────── */
/* Tipos                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

interface TokenRow {
  id: string;
  name: string;
  token_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

interface WebhookRow {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  active: boolean;
  description: string | null;
  last_triggered_at: string | null;
  last_status: string | null;
  failure_count: number;
  created_at: string;
  updated_at: string;
}

const AVAILABLE_SCOPES = [
  { value: "read", label: "Leitura" },
  { value: "write", label: "Escrita" },
  { value: "admin", label: "Admin" },
] as const;

const AVAILABLE_EVENTS = [
  { value: "budget.published", label: "Orçamento publicado" },
  { value: "budget.status_changed", label: "Status alterado" },
  { value: "budget.contract_closed", label: "Contrato fechado" },
  { value: "lead.created", label: "Novo lead" },
  { value: "client.created", label: "Novo cliente" },
] as const;

const EXPIRY_PRESETS = [
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "180", label: "180 dias" },
  { value: "365", label: "1 ano" },
  { value: "never", label: "Nunca expira" },
] as const;

/* ────────────────────────────────────────────────────────────────────────── */
/* Helpers                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

function copyToClipboard(value: string, label: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(value).then(
      () => toast.success(`${label} copiado.`),
      () => toast.error("Não foi possível copiar."),
    );
  } else {
    toast.error("Clipboard indisponível neste navegador.");
  }
}

function tokenStatus(t: TokenRow): { label: string; tone: "ok" | "warn" | "danger" } {
  if (t.revoked_at) return { label: "Revogado", tone: "danger" };
  if (t.expires_at && new Date(t.expires_at).getTime() < Date.now()) {
    return { label: "Expirado", tone: "danger" };
  }
  if (t.expires_at) {
    const days = Math.round(
      (new Date(t.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    if (days <= 14) return { label: `Expira em ${days}d`, tone: "warn" };
  }
  return { label: "Ativo", tone: "ok" };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Página                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

export default function IntegracaoPage() {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookRow | null>(null);

  const apiBaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
  const apiRestUrl = useMemo(
    () => (apiBaseUrl ? `${apiBaseUrl.replace(/\/$/, "")}/rest/v1` : ""),
    [apiBaseUrl],
  );
  const apiFunctionsUrl = useMemo(
    () => (apiBaseUrl ? `${apiBaseUrl.replace(/\/$/, "")}/functions/v1` : ""),
    [apiBaseUrl],
  );

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [tokenRes, webhookRes] = await Promise.all([
        db
          .from("personal_access_tokens")
          .select("id, name, token_prefix, scopes, last_used_at, expires_at, revoked_at, created_at")
          .order("created_at", { ascending: false }),
        db
          .from("integration_webhooks")
          .select(
            "id, name, url, secret, events, active, description, last_triggered_at, last_status, failure_count, created_at, updated_at",
          )
          .order("created_at", { ascending: false }),
      ]);

      if (tokenRes.error) throw tokenRes.error;
      if (webhookRes.error) throw webhookRes.error;

      setTokens((tokenRes.data ?? []) as TokenRow[]);
      setWebhooks((webhookRes.data ?? []) as WebhookRow[]);
    } catch (err) {
      logger.error("[IntegracaoPage] load", err);
      toast.error(err instanceof Error ? err.message : "Erro ao carregar integrações.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-6xl mx-auto">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Plug className="h-6 w-6 text-primary" />
            Integração
          </h1>
          <p className="text-sm text-muted-foreground font-body mt-1 max-w-2xl">
            Tudo o que é necessário para integrar o Envision com ferramentas externas
            (Zapier, Make, n8n, etc.): URL base da API, tokens pessoais e webhooks.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Atualizar
        </Button>
      </header>

      <ApiBaseSection
        apiBaseUrl={apiBaseUrl}
        apiRestUrl={apiRestUrl}
        apiFunctionsUrl={apiFunctionsUrl}
      />

      <TokensSection
        tokens={tokens}
        loading={loading}
        onGenerate={() => setTokenDialogOpen(true)}
        onRevoked={load}
      />

      <WebhooksSection
        webhooks={webhooks}
        loading={loading}
        onCreate={() => {
          setEditingWebhook(null);
          setWebhookDialogOpen(true);
        }}
        onEdit={(w) => {
          setEditingWebhook(w);
          setWebhookDialogOpen(true);
        }}
        onChanged={load}
      />

      <GenerateTokenDialog
        open={tokenDialogOpen}
        onOpenChange={(open) => {
          setTokenDialogOpen(open);
          if (!open) setGeneratedToken(null);
        }}
        generatedToken={generatedToken}
        onGenerated={(token) => {
          setGeneratedToken(token);
          void load();
        }}
      />

      <WebhookDialog
        open={webhookDialogOpen}
        onOpenChange={setWebhookDialogOpen}
        existing={editingWebhook}
        onSaved={() => {
          setWebhookDialogOpen(false);
          setEditingWebhook(null);
          void load();
        }}
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Seção: URL base da API                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

function ApiBaseSection({
  apiBaseUrl,
  apiRestUrl,
  apiFunctionsUrl,
}: {
  apiBaseUrl: string;
  apiRestUrl: string;
  apiFunctionsUrl: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-display flex items-center gap-2">
          <Plug className="h-4 w-4 text-primary" />
          URL base da API
        </CardTitle>
        <CardDescription className="font-body">
          Endpoints REST e Edge Functions do Supabase. Use junto com um token pessoal
          (cabeçalho <code className="font-mono text-[11px]">Authorization: Bearer …</code>) e a
          chave anônima publicável.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <UrlRow label="Base do projeto" value={apiBaseUrl} />
        <UrlRow label="REST (PostgREST)" value={apiRestUrl} />
        <UrlRow label="Edge Functions" value={apiFunctionsUrl} />

        <Alert className="bg-muted/50 border-hairline">
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle className="font-body text-sm">Como autenticar</AlertTitle>
          <AlertDescription className="font-body text-xs leading-relaxed">
            Envie os cabeçalhos <code className="font-mono">apikey: &lt;VITE_SUPABASE_PUBLISHABLE_KEY&gt;</code>{" "}
            e <code className="font-mono">Authorization: Bearer &lt;token&gt;</code>. Tokens pessoais
            herdam as permissões do usuário que os criou (RLS continua valendo).
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

function UrlRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-body">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <Input readOnly value={value || "—"} className="font-mono text-xs" />
        <Button
          variant="outline"
          size="icon"
          onClick={() => copyToClipboard(value, label)}
          disabled={!value}
          aria-label={`Copiar ${label}`}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Seção: Tokens pessoais                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

function TokensSection({
  tokens,
  loading,
  onGenerate,
  onRevoked,
}: {
  tokens: TokenRow[];
  loading: boolean;
  onGenerate: () => void;
  onRevoked: () => void;
}) {
  const confirm = useConfirm();
  const [revoking, setRevoking] = useState<string | null>(null);

  async function handleRevoke(token: TokenRow) {
    const ok = await confirm({
      title: "Revogar token?",
      description: `O token "${token.name}" deixará de funcionar imediatamente. Esta ação não pode ser desfeita.`,
      confirmText: "Revogar",
      destructive: true,
    });
    if (!ok) return;

    setRevoking(token.id);
    try {
      const { error } = await db.rpc("revoke_personal_access_token", { p_id: token.id });
      if (error) throw error;
      toast.success("Token revogado.");
      onRevoked();
    } catch (err) {
      logger.error("[IntegracaoPage] revoke", err);
      toast.error(err instanceof Error ? err.message : "Erro ao revogar token.");
    } finally {
      setRevoking(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base font-display flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            Tokens de acesso pessoal
          </CardTitle>
          <CardDescription className="font-body">
            Use no cabeçalho <code className="font-mono text-[11px]">Authorization: Bearer …</code>{" "}
            para autenticar chamadas a partir de Zapier, scripts, integrações server-to-server.
          </CardDescription>
        </div>
        <Button size="sm" onClick={onGenerate} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          Gerar token
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground font-body py-4 text-center">
            Nenhum token criado ainda.
          </p>
        ) : (
          <ul className="divide-y divide-hairline">
            {tokens.map((t) => {
              const status = tokenStatus(t);
              const tone =
                status.tone === "ok"
                  ? "default"
                  : status.tone === "warn"
                    ? "secondary"
                    : "destructive";
              return (
                <li key={t.id} className="py-3 flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-body font-medium text-sm text-foreground">
                        {t.name}
                      </span>
                      <Badge variant={tone} className="h-5 px-1.5 text-[10px]">
                        {status.label}
                      </Badge>
                      {t.scopes.map((s) => (
                        <Badge key={s} variant="outline" className="h-5 px-1.5 text-[10px]">
                          {s}
                        </Badge>
                      ))}
                    </div>
                    <p className="font-mono text-[11px] text-muted-foreground mt-1">
                      {t.token_prefix}
                      <span className="opacity-60">…••••••••</span>
                    </p>
                    <div className="text-[11px] text-muted-foreground font-body mt-1 space-x-3">
                      <span>Criado em {formatDate(t.created_at)}</span>
                      {t.expires_at && <span>Expira em {formatDate(t.expires_at)}</span>}
                      {t.last_used_at && <span>Último uso {formatDate(t.last_used_at)}</span>}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRevoke(t)}
                    disabled={!!t.revoked_at || revoking === t.id}
                    className="gap-2 shrink-0"
                  >
                    {revoking === t.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    {t.revoked_at ? "Revogado" : "Revogar"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Diálogo: gerar token                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

function GenerateTokenDialog({
  open,
  onOpenChange,
  generatedToken,
  onGenerated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  generatedToken: string | null;
  onGenerated: (token: string) => void;
}) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["read"]);
  const [expiry, setExpiry] = useState<string>("90");
  const [submitting, setSubmitting] = useState(false);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setScopes(["read"]);
      setExpiry("90");
      setShowToken(false);
    }
  }, [open]);

  function toggleScope(value: string) {
    setScopes((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value],
    );
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Informe um nome para o token.");
      return;
    }
    if (scopes.length === 0) {
      toast.error("Selecione ao menos um escopo.");
      return;
    }
    setSubmitting(true);
    try {
      const expiresAt =
        expiry === "never"
          ? null
          : new Date(Date.now() + Number(expiry) * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await db.rpc("create_personal_access_token", {
        p_name: name.trim(),
        p_scopes: scopes,
        p_expires_at: expiresAt,
      });
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.token) throw new Error("RPC não retornou o token.");
      onGenerated(row.token);
      toast.success("Token gerado. Copie-o agora — só será exibido uma vez.");
    } catch (err) {
      logger.error("[IntegracaoPage] create token", err);
      toast.error(err instanceof Error ? err.message : "Erro ao gerar token.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            {generatedToken ? "Token gerado" : "Gerar token de acesso pessoal"}
          </DialogTitle>
          <DialogDescription className="font-body">
            {generatedToken
              ? "Copie agora — por segurança, não conseguiremos exibi-lo novamente."
              : "Use este token para autenticar chamadas externas. Trate-o como uma senha."}
          </DialogDescription>
        </DialogHeader>

        {generatedToken ? (
          <div className="space-y-3">
            <Alert variant="destructive" className="bg-destructive/5">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="font-body text-sm">Visível apenas uma vez</AlertTitle>
              <AlertDescription className="font-body text-xs">
                Salve em um cofre de senhas. Ao fechar este diálogo, o valor não poderá mais ser
                recuperado.
              </AlertDescription>
            </Alert>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={showToken ? generatedToken : "•".repeat(generatedToken.length)}
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowToken((s) => !s)}
                aria-label={showToken ? "Ocultar" : "Mostrar"}
              >
                {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(generatedToken, "Token")}
                aria-label="Copiar"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)} className="w-full">
                <Check className="h-4 w-4 mr-2" />
                Já guardei o token
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="token-name" className="font-body">
                Nome
              </Label>
              <Input
                id="token-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Zapier produção"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground font-body">
                Apenas para identificação interna.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="font-body">Escopos</Label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_SCOPES.map((s) => {
                  const active = scopes.includes(s.value);
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => toggleScope(s.value)}
                      className={`text-xs px-2.5 py-1 rounded-md border font-body transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-foreground border-input hover:bg-muted"
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="token-expiry" className="font-body">
                Expiração
              </Label>
              <Select value={expiry} onValueChange={setExpiry}>
                <SelectTrigger id="token-expiry">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4" />
                )}
                Gerar token
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Seção: Webhooks                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

function WebhooksSection({
  webhooks,
  loading,
  onCreate,
  onEdit,
  onChanged,
}: {
  webhooks: WebhookRow[];
  loading: boolean;
  onCreate: () => void;
  onEdit: (w: WebhookRow) => void;
  onChanged: () => void;
}) {
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleToggle(w: WebhookRow) {
    setBusyId(w.id);
    try {
      const { error } = await supabase
        .from("integration_webhooks")
        .update({ active: !w.active })
        .eq("id", w.id);
      if (error) throw error;
      toast.success(w.active ? "Webhook desativado." : "Webhook ativado.");
      onChanged();
    } catch (err) {
      logger.error("[IntegracaoPage] toggle webhook", err);
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar webhook.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(w: WebhookRow) {
    const ok = await confirm({
      title: "Excluir webhook?",
      description: `O webhook "${w.name}" será removido permanentemente.`,
      confirmText: "Excluir",
      destructive: true,
    });
    if (!ok) return;

    setBusyId(w.id);
    try {
      const { error } = await db.from("integration_webhooks").delete().eq("id", w.id);
      if (error) throw error;
      toast.success("Webhook removido.");
      onChanged();
    } catch (err) {
      logger.error("[IntegracaoPage] delete webhook", err);
      toast.error(err instanceof Error ? err.message : "Erro ao remover webhook.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Webhook className="h-4 w-4 text-primary" />
            Webhooks
          </CardTitle>
          <CardDescription className="font-body">
            URLs externas notificadas em eventos do sistema. Compatível com Zapier
            (catch hook), Make, n8n e webhooks customizados.
          </CardDescription>
        </div>
        <Button size="sm" onClick={onCreate} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          Novo webhook
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : webhooks.length === 0 ? (
          <p className="text-sm text-muted-foreground font-body py-4 text-center">
            Nenhum webhook configurado.
          </p>
        ) : (
          <ul className="divide-y divide-hairline">
            {webhooks.map((w) => (
              <li key={w.id} className="py-3 space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-body font-medium text-sm text-foreground">
                        {w.name}
                      </span>
                      {w.active ? (
                        <Badge variant="default" className="h-5 px-1.5 text-[10px]">
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                          Inativo
                        </Badge>
                      )}
                      {w.failure_count > 0 && (
                        <Badge
                          variant="destructive"
                          className="h-5 px-1.5 text-[10px] gap-0.5"
                        >
                          <ShieldAlert className="h-2.5 w-2.5" />
                          {w.failure_count} falha{w.failure_count === 1 ? "" : "s"}
                        </Badge>
                      )}
                    </div>
                    <p className="font-mono text-[11px] text-muted-foreground mt-1 truncate">
                      {w.url}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {w.events.length === 0 ? (
                        <span className="text-[11px] text-muted-foreground font-body italic">
                          Sem eventos selecionados
                        </span>
                      ) : (
                        w.events.map((e) => (
                          <Badge key={e} variant="outline" className="h-5 px-1.5 text-[10px]">
                            {AVAILABLE_EVENTS.find((x) => x.value === e)?.label ?? e}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch
                      checked={w.active}
                      onCheckedChange={() => handleToggle(w)}
                      disabled={busyId === w.id}
                      aria-label={w.active ? "Desativar" : "Ativar"}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(w)}
                      disabled={busyId === w.id}
                      aria-label="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(w)}
                      disabled={busyId === w.id}
                      aria-label="Excluir"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {(w.last_triggered_at || w.last_status) && (
                  <p className="text-[11px] text-muted-foreground font-body">
                    {w.last_triggered_at && (
                      <>Último disparo {formatDate(w.last_triggered_at)} </>
                    )}
                    {w.last_status && <>· status {w.last_status}</>}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Diálogo: criar/editar webhook                                              */
/* ────────────────────────────────────────────────────────────────────────── */

function WebhookDialog({
  open,
  onOpenChange,
  existing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: WebhookRow | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(existing?.name ?? "");
      setUrl(existing?.url ?? "");
      setSecret(existing?.secret ?? "");
      setEvents(existing?.events ?? []);
      setActive(existing?.active ?? true);
      setDescription(existing?.description ?? "");
    }
  }, [open, existing]);

  function toggleEvent(value: string) {
    setEvents((prev) =>
      prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value],
    );
  }

  async function handleSubmit() {
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    if (!trimmedName) {
      toast.error("Informe um nome.");
      return;
    }
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      toast.error("URL deve começar com http(s)://");
      return;
    }

    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const payload = {
        name: trimmedName,
        url: trimmedUrl,
        secret: secret.trim() || null,
        events,
        active,
        description: description.trim() || null,
      };

      if (existing) {
        const { error } = await supabase
          .from("integration_webhooks")
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
        toast.success("Webhook atualizado.");
      } else {
        if (!userId) throw new Error("Usuário não autenticado.");
        const { error } = await supabase
          .from("integration_webhooks")
          .insert({ ...payload, created_by: userId });
        if (error) throw error;
        toast.success("Webhook criado.");
      }
      onSaved();
    } catch (err) {
      logger.error("[IntegracaoPage] save webhook", err);
      toast.error(err instanceof Error ? err.message : "Erro ao salvar webhook.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">
            {existing ? "Editar webhook" : "Novo webhook"}
          </DialogTitle>
          <DialogDescription className="font-body">
            Informe a URL que receberá um POST com o payload do evento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="wh-name" className="font-body">
              Nome
            </Label>
            <Input
              id="wh-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Zap → Slack #vendas"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wh-url" className="font-body">
              URL
            </Label>
            <Input
              id="wh-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hooks.zapier.com/hooks/catch/..."
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wh-secret" className="font-body">
              Secret (opcional)
            </Label>
            <Input
              id="wh-secret"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Assinatura HMAC enviada como X-Bwild-Signature"
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground font-body">
              Se preenchido, cada chamada inclui o cabeçalho{" "}
              <code className="font-mono">X-Bwild-Signature</code> com HMAC-SHA256 do corpo.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="font-body">Eventos</Label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_EVENTS.map((ev) => {
                const on = events.includes(ev.value);
                return (
                  <button
                    key={ev.value}
                    type="button"
                    onClick={() => toggleEvent(ev.value)}
                    className={`text-xs px-2.5 py-1 rounded-md border font-body transition-colors ${
                      on
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-input hover:bg-muted"
                    }`}
                  >
                    {ev.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wh-desc" className="font-body">
              Descrição (opcional)
            </Label>
            <Textarea
              id="wh-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Para que serve este webhook?"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label className="font-body flex items-center gap-2">
                {active ? (
                  <Power className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <PowerOff className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                Ativo
              </Label>
              <p className="text-[11px] text-muted-foreground font-body">
                Webhooks inativos não recebem eventos.
              </p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {existing ? "Salvar" : "Criar webhook"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
