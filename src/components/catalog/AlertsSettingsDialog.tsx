import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useCatalogAlertsConfig } from "@/hooks/useCatalogAlerts";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function AlertsSettingsDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { data: config } = useCatalogAlertsConfig();
  const [stale, setStale] = useState(90);
  const [highLead, setHighLead] = useState(30);
  const [maxIncrease, setMaxIncrease] = useState(20);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setStale(config.stale_price_days);
      setHighLead(config.high_lead_time_days);
      setMaxIncrease(Number(config.max_price_increase_pct));
    }
  }, [config, open]);

  const handleSave = async () => {
    if (!config?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from("catalog_alerts_config")
      .update({
        stale_price_days: stale,
        high_lead_time_days: highLead,
        max_price_increase_pct: maxIncrease,
        updated_at: new Date().toISOString(),
      })
      .eq("id", config.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar configurações");
      return;
    }
    toast.success("Configurações de alerta atualizadas");
    queryClient.invalidateQueries({ queryKey: ["catalog_alerts_config"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurações de alertas</DialogTitle>
          <DialogDescription>
            Defina quando os itens do catálogo devem mostrar avisos.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div>
            <Label className="text-sm">Preço considerado antigo após (dias)</Label>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              value={stale}
              onChange={(e) => setStale(parseInt(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Itens com preço primário desatualizado mostram alerta amarelo.
            </p>
          </div>
          <div>
            <Label className="text-sm">Lead time considerado alto (dias)</Label>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              value={highLead}
              onChange={(e) => setHighLead(parseInt(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label className="text-sm">Aumento de preço relevante (%)</Label>
            <Input
              type="number"
              inputMode="decimal"
              min={1}
              step={0.5}
              value={maxIncrease}
              onChange={(e) => setMaxIncrease(parseFloat(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Variações acima desse percentual disparam toast de alerta.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !config}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
