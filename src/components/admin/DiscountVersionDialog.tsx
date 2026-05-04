import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, BadgePercent, ExternalLink, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { useAuth } from "@/hooks/useAuth";
import { createDiscountVersionAndPublish } from "@/lib/budget-versioning";
import { getPublicBudgetUrl } from "@/lib/getPublicUrl";

interface DiscountVersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetId: string;
  projectName?: string;
  onSuccess?: () => void;
}

export function DiscountVersionDialog({
  open,
  onOpenChange,
  budgetId,
  projectName,
  onSuccess,
}: DiscountVersionDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [amount, setAmount] = useState<number | null>(null);
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setAmount(null);
    setLabel("");
    setSubmitting(false);
  }

  async function handleSubmit() {
    if (!user) {
      toast.error("Sessão expirada");
      return;
    }
    if (!amount || amount <= 0) {
      toast.error("Informe um valor de desconto maior que zero");
      return;
    }
    setSubmitting(true);
    try {
      const { newBudgetId, publicId } = await createDiscountVersionAndPublish(
        budgetId,
        user.id,
        amount,
        label.trim() || undefined,
      );
      const url = getPublicBudgetUrl(publicId);
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        /* não bloqueia */
      }
      toast.success("Nova versão com desconto publicada", {
        description: "Link copiado para a área de transferência.",
        action: {
          label: "Abrir",
          onClick: () => window.open(url, "_blank", "noopener,noreferrer"),
        },
      });
      onOpenChange(false);
      reset();
      onSuccess?.();
      navigate(`/admin/budget/${newBudgetId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar versão com desconto");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!submitting) {
          onOpenChange(o);
          if (!o) reset();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BadgePercent className="h-5 w-5 text-primary" />
            Nova versão com desconto
          </DialogTitle>
          <DialogDescription>
            {projectName ? <strong>{projectName}</strong> : "Este orçamento"} ganha uma nova versão
            idêntica à atual, com apenas a adição de um desconto comercial. A versão é publicada
            automaticamente e o link público é atualizado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="discount-amount">Valor do desconto</Label>
            <CurrencyInput
              id="discount-amount"
              value={amount}
              onChange={setAmount}
              allowNegative={false}
              placeholder="R$ 0,00"
              className="text-lg font-mono"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Será gravado como abatimento na seção <strong>Descontos</strong>.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="discount-label">
              Identificação <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input
              id="discount-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex.: Desconto fechamento até 30/05"
              maxLength={120}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !amount || amount <= 0}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Publicando…
              </>
            ) : (
              <>
                <ExternalLink className="h-4 w-4 mr-2" />
                Criar e publicar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
