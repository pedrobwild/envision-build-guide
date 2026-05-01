import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Loader2, Eye, EyeOff, MessageSquare, Save, Webhook, KeyRound, Copy, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

// Validation schemas
const tokenSchema = z
  .string()
  .trim()
  .min(20, "O API Token parece curto demais (mínimo 20 caracteres).")
  .max(2048, "O API Token excede 2048 caracteres.")
  .regex(/^[A-Za-z0-9._\-+/=]+$/, "O API Token contém caracteres inválidos.");

const secretSchema = z
  .string()
  .trim()
  .min(16, "O Webhook Secret deve ter pelo menos 16 caracteres.")
  .max(256, "O Webhook Secret excede 256 caracteres.")
  .regex(/^[A-Za-z0-9._\-+/=]+$/, "O Webhook Secret contém caracteres inválidos.");

const baseUrlSchema = z
  .string()
  .trim()
  .url("URL inválida.")
  .refine((v) => v.startsWith("https://"), "A URL precisa começar com https://");

const optionalIdSchema = z
  .string()
  .trim()
  .max(128, "Identificador muito longo.")
  .regex(/^[A-Za-z0-9._-]*$/, "Identificador contém caracteres inválidos.")
  .optional();

interface DigisacConfigRow {
  id: string;
  enabled: boolean;
  api_base_url: string;
  api_token: string | null;
  webhook_secret: string | null;
  default_service_id: string | null;
  default_user_id: string | null;
  updated_at: string;
}

function maskValue(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "•".repeat(value.length);
  const head = value.slice(0, 4);
  const tail = value.slice(-4);
  return `${head}${"•".repeat(Math.max(8, value.length - 8))}${tail}`;
}

export default function DigisacConfigPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [row, setRow] = useState<DigisacConfigRow | null>(null);

  // Form fields
  const [enabled, setEnabled] = useState(true);
  const [apiBaseUrl, setApiBaseUrl] = useState("https://app.digisac.me/api/v1");
  const [apiToken, setApiToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [defaultServiceId, setDefaultServiceId] = useState("");
  const [defaultUserId, setDefaultUserId] = useState("");

  // UI state
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [tokenTouched, setTokenTouched] = useState(false);
  const [secretTouched, setSecretTouched] = useState(false);
  const [copied, setCopied] = useState(false);

  const webhookUrl = useMemo(
    () => (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/digisac-webhook` : ""),
    []
  );

  // Load existing config
  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("digisac_config")
        .select(
          "id, enabled, api_base_url, api_token, webhook_secret, default_service_id, default_user_id, updated_at"
        )
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setRow(data as DigisacConfigRow);
        setEnabled(data.enabled);
        setApiBaseUrl(data.api_base_url || "https://app.digisac.me/api/v1");
        setApiToken(data.api_token || "");
        setWebhookSecret(data.webhook_secret || "");
        setDefaultServiceId(data.default_service_id || "");
        setDefaultUserId(data.default_user_id || "");
      }
    } catch (err) {
      toast({
        title: "Erro ao carregar configuração",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  // Validation results (only show errors after the user touches the field)
  const tokenError = useMemo(() => {
    if (!tokenTouched && row?.api_token === apiToken) return null;
    if (!apiToken) return "O API Token é obrigatório.";
    const r = tokenSchema.safeParse(apiToken);
    return r.success ? null : r.error.issues[0]?.message ?? "Token inválido.";
  }, [apiToken, tokenTouched, row?.api_token]);

  const secretError = useMemo(() => {
    if (!secretTouched && row?.webhook_secret === webhookSecret) return null;
    if (!webhookSecret) return "O Webhook Secret é obrigatório.";
    const r = secretSchema.safeParse(webhookSecret);
    return r.success ? null : r.error.issues[0]?.message ?? "Secret inválido.";
  }, [webhookSecret, secretTouched, row?.webhook_secret]);

  const baseUrlError = useMemo(() => {
    const r = baseUrlSchema.safeParse(apiBaseUrl);
    return r.success ? null : r.error.issues[0]?.message ?? "URL inválida.";
  }, [apiBaseUrl]);

  const serviceIdError = useMemo(() => {
    const r = optionalIdSchema.safeParse(defaultServiceId);
    return r.success ? null : r.error.issues[0]?.message ?? "Inválido.";
  }, [defaultServiceId]);

  const userIdError = useMemo(() => {
    const r = optionalIdSchema.safeParse(defaultUserId);
    return r.success ? null : r.error.issues[0]?.message ?? "Inválido.";
  }, [defaultUserId]);

  const isValid =
    !baseUrlError && !serviceIdError && !userIdError && !tokenError && !secretError;

  const isDirty =
    !row ||
    enabled !== row.enabled ||
    apiBaseUrl !== row.api_base_url ||
    apiToken !== (row.api_token ?? "") ||
    webhookSecret !== (row.webhook_secret ?? "") ||
    defaultServiceId !== (row.default_service_id ?? "") ||
    defaultUserId !== (row.default_user_id ?? "");

  async function handleSave() {
    setTokenTouched(true);
    setSecretTouched(true);

    if (!isValid) {
      toast({
        title: "Verifique os campos",
        description: "Existem erros de validação no formulário.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        enabled,
        api_base_url: apiBaseUrl.trim(),
        api_token: apiToken.trim(),
        webhook_secret: webhookSecret.trim(),
        default_service_id: defaultServiceId.trim() || null,
        default_user_id: defaultUserId.trim() || null,
        updated_at: new Date().toISOString(),
      };

      let result;
      if (row?.id) {
        result = await supabase
          .from("digisac_config")
          .update(payload)
          .eq("id", row.id)
          .select(
            "id, enabled, api_base_url, api_token, webhook_secret, default_service_id, default_user_id, updated_at"
          )
          .single();
      } else {
        result = await supabase
          .from("digisac_config")
          .insert({ ...payload, singleton: true })
          .select(
            "id, enabled, api_base_url, api_token, webhook_secret, default_service_id, default_user_id, updated_at"
          )
          .single();
      }

      if (result.error) throw result.error;
      setRow(result.data as DigisacConfigRow);
      setTokenTouched(false);
      setSecretTouched(false);

      toast({
        title: "Configuração salva",
        description: "A integração com a Digisac foi atualizada com sucesso.",
      });
    } catch (err) {
      toast({
        title: "Erro ao salvar",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyWebhook() {
    if (!webhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  }

  return (
    <Card className="border bg-card">
      <CardContent className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="bg-muted p-2.5 rounded-lg">
            <MessageSquare className="h-5 w-5 text-foreground/70" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-display font-semibold text-foreground">
                Integração Digisac (WhatsApp)
              </h2>
              {row ? (
                <Badge
                  variant={enabled && !!row.api_token && !!row.webhook_secret ? "default" : "secondary"}
                  className="text-[10px]"
                >
                  {enabled && !!row.api_token && !!row.webhook_secret ? "Ativa" : "Pendente"}
                </Badge>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground font-body mt-1">
              Configure o token da API e o segredo do webhook para receber e enviar mensagens do WhatsApp via Digisac.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Enable switch */}
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Integração ativa</p>
                <p className="text-xs text-muted-foreground">
                  Quando desativada, o webhook continua recebendo eventos mas o envio é bloqueado.
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            {/* API Base URL */}
            <div className="space-y-2">
              <Label htmlFor="digisac-base-url">URL base da API</Label>
              <Input
                id="digisac-base-url"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                placeholder="https://app.digisac.me/api/v1"
                spellCheck={false}
                autoComplete="off"
                className={baseUrlError ? "border-destructive" : ""}
              />
              {baseUrlError ? (
                <p className="text-xs text-destructive">{baseUrlError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Padrão: <code className="font-mono">https://app.digisac.me/api/v1</code>
                </p>
              )}
            </div>

            {/* API Token */}
            <div className="space-y-2">
              <Label htmlFor="digisac-token" className="flex items-center gap-2">
                <KeyRound className="h-3.5 w-3.5" />
                API Token
              </Label>
              <div className="relative">
                <Input
                  id="digisac-token"
                  type={showToken ? "text" : "password"}
                  value={
                    showToken || tokenTouched || apiToken !== (row?.api_token ?? "")
                      ? apiToken
                      : maskValue(apiToken)
                  }
                  onChange={(e) => {
                    setTokenTouched(true);
                    setApiToken(e.target.value);
                  }}
                  onFocus={() => setTokenTouched(true)}
                  placeholder="Cole o token gerado no painel da Digisac"
                  spellCheck={false}
                  autoComplete="off"
                  className={`pr-10 font-mono text-sm ${tokenError ? "border-destructive" : ""}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowToken((s) => !s)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
                  aria-label={showToken ? "Ocultar token" : "Mostrar token"}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {tokenError ? (
                <p className="text-xs text-destructive">{tokenError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Encontrado em <strong>Digisac → Configurações → Integrações → API</strong>.
                </p>
              )}
            </div>

            {/* Webhook Secret */}
            <div className="space-y-2">
              <Label htmlFor="digisac-secret" className="flex items-center gap-2">
                <Webhook className="h-3.5 w-3.5" />
                Webhook Secret
              </Label>
              <div className="relative">
                <Input
                  id="digisac-secret"
                  type={showSecret ? "text" : "password"}
                  value={
                    showSecret || secretTouched || webhookSecret !== (row?.webhook_secret ?? "")
                      ? webhookSecret
                      : maskValue(webhookSecret)
                  }
                  onChange={(e) => {
                    setSecretTouched(true);
                    setWebhookSecret(e.target.value);
                  }}
                  onFocus={() => setSecretTouched(true)}
                  placeholder="Defina um segredo forte (mín. 16 caracteres)"
                  spellCheck={false}
                  autoComplete="off"
                  className={`pr-10 font-mono text-sm ${secretError ? "border-destructive" : ""}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSecret((s) => !s)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
                  aria-label={showSecret ? "Ocultar secret" : "Mostrar secret"}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {secretError ? (
                <p className="text-xs text-destructive">{secretError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Use o mesmo valor no painel da Digisac como header{" "}
                  <code className="font-mono">Authorization: Bearer &lt;secret&gt;</code> ou como chave HMAC-SHA256.
                </p>
              )}
            </div>

            {/* Webhook URL helper */}
            {webhookUrl && (
              <div className="rounded-lg border border-dashed bg-muted/20 p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                    URL do Webhook (cole no painel da Digisac)
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyWebhook}
                    className="h-7 gap-1.5"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-primary" /> Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copiar
                      </>
                    )}
                  </Button>
                </div>
                <code className="block text-xs font-mono break-all text-foreground/80">
                  {webhookUrl}
                </code>
              </div>
            )}

            {/* Optional defaults */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="digisac-service">Service ID padrão (opcional)</Label>
                <Input
                  id="digisac-service"
                  value={defaultServiceId}
                  onChange={(e) => setDefaultServiceId(e.target.value)}
                  placeholder="Ex: 9c3f..."
                  spellCheck={false}
                  autoComplete="off"
                  className={`font-mono text-sm ${serviceIdError ? "border-destructive" : ""}`}
                />
                {serviceIdError && <p className="text-xs text-destructive">{serviceIdError}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="digisac-user">User ID padrão (opcional)</Label>
                <Input
                  id="digisac-user"
                  value={defaultUserId}
                  onChange={(e) => setDefaultUserId(e.target.value)}
                  placeholder="Atendente padrão"
                  spellCheck={false}
                  autoComplete="off"
                  className={`font-mono text-sm ${userIdError ? "border-destructive" : ""}`}
                />
                {userIdError && <p className="text-xs text-destructive">{userIdError}</p>}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                {row?.updated_at
                  ? `Última atualização: ${new Date(row.updated_at).toLocaleString("pt-BR")}`
                  : "Configuração ainda não salva."}
              </p>
              <Button
                onClick={handleSave}
                disabled={saving || !isValid || !isDirty}
                className="gap-2"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? "Salvando..." : "Salvar configuração"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
