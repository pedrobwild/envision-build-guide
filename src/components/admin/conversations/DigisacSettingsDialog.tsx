import { useEffect, useState } from "react";
import { Loader2, Settings2, RefreshCw, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  useDigisacConfig,
  useSaveDigisacConfig,
  useSyncDigisac,
} from "@/hooks/useConversations";

export function DigisacSettingsDialog() {
  const { data: cfg, isLoading } = useDigisacConfig();
  const save = useSaveDigisacConfig();
  const sync = useSyncDigisac();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const [baseUrl, setBaseUrl] = useState("");
  const [token, setToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [userId, setUserId] = useState("");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!cfg) return;
    setBaseUrl(cfg.api_base_url ?? "https://app.digisac.biz/api/v1");
    setToken(cfg.api_token ?? "");
    setWebhookSecret(cfg.webhook_secret ?? "");
    setServiceId(cfg.default_service_id ?? "");
    setUserId(cfg.default_user_id ?? "");
    setEnabled(cfg.enabled ?? true);
  }, [cfg]);

  const onSave = async () => {
    try {
      await save.mutateAsync({
        id: cfg?.id,
        api_base_url: baseUrl.trim() || "https://app.digisac.biz/api/v1",
        api_token: token.trim() || null,
        webhook_secret: webhookSecret.trim() || null,
        default_service_id: serviceId.trim() || null,
        default_user_id: userId.trim() || null,
        enabled,
      });
      toast({ title: "Configuração salva" });
    } catch (e) {
      toast({
        title: "Erro ao salvar",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

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

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/digisac-webhook`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <Settings2 className="h-3.5 w-3.5" />
          Configurar Digisac
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Integração Digisac</DialogTitle>
          <DialogDescription>
            Configure credenciais da API para receber e enviar mensagens do Digisac
            no módulo de conversas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">Integração ativa</Label>
              <p className="text-[10.5px] text-muted-foreground font-body">
                Quando desativada, a sincronização e envio ficam bloqueados.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">URL base da API</Label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://app.digisac.biz/api/v1"
              className="h-8 text-xs font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Token da API</Label>
            <Input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Bearer token (Configurações → API no Digisac)"
              type="password"
              className="h-8 text-xs font-mono"
            />
            <p className="text-[10px] text-muted-foreground font-body">
              Gere em <code className="text-[10px]">Configurações &rarr; API/Integrações</code> no
              painel do Digisac.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Webhook secret (opcional)</Label>
            <Input
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="Valida requisições recebidas no webhook"
              className="h-8 text-xs font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Service ID padrão</Label>
              <Input
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                placeholder="Ex: whatsapp-oficial"
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">User ID padrão</Label>
              <Input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="ID do atendente"
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          <div className="rounded-md border border-border/60 bg-muted/40 p-3 space-y-1.5">
            <p className="text-[10.5px] font-semibold">URL do webhook (configure no Digisac):</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[10px] bg-background px-2 py-1.5 rounded border border-border/60 font-mono break-all">
                {webhookUrl}
              </code>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrl);
                  toast({ title: "URL copiada" });
                }}
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground font-body">
              No Digisac, adicione essa URL como webhook para eventos de mensagens e
              tickets. Se definir "webhook secret", envie no header{" "}
              <code className="text-[9.5px]">x-webhook-secret</code>.
            </p>
          </div>

          {cfg?.last_synced_at && (
            <p className="text-[10px] text-muted-foreground font-body">
              Última sincronização:{" "}
              {new Date(cfg.last_synced_at).toLocaleString("pt-BR")}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={onSync}
            disabled={sync.isPending || !token.trim()}
          >
            {sync.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Sincronizar agora
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Fechar
            </Button>
            <Button size="sm" onClick={onSave} disabled={save.isPending || isLoading}>
              {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
