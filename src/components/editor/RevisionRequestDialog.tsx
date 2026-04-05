import { useState, useEffect } from "react";
import { RotateCcw, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { logRevisionRequestEvent } from "@/lib/version-audit";
import { toast } from "sonner";

const CHANGE_TYPES = [
  { value: "inclusion", label: "Inclusão de itens ou escopo" },
  { value: "removal", label: "Remoção de itens ou escopo" },
  { value: "price", label: "Revisão de preços" },
  { value: "scope", label: "Alteração de especificações técnicas" },
  { value: "other", label: "Outro" },
] as const;

interface RevisionRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetId: string;
  currentStatus: string;
  onSuccess: () => void;
}

export function RevisionRequestDialog({
  open,
  onOpenChange,
  budgetId,
  currentStatus,
  onSuccess,
}: RevisionRequestDialogProps) {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [instructions, setInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedTypes([]);
      setInstructions("");
      setError("");
    }
  }, [open]);

  function toggleType(value: string) {
    setSelectedTypes((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    );
  }

  async function handleSubmit() {
    const trimmed = instructions.trim();
    if (trimmed.length < 20) {
      setError("As instruções devem ter pelo menos 20 caracteres.");
      return;
    }
    setError("");
    setSubmitting(true);

    try {
      // 1. Update budget status
      const { error: updateErr } = await supabase
        .from("budgets")
        .update({
          internal_status: "revision_requested",
          updated_at: new Date().toISOString(),
        })
        .eq("id", budgetId);

      if (updateErr) throw updateErr;

      // 2. Log revision request event
      await logRevisionRequestEvent({
        budgetId,
        userId: user!.id,
        instructions: trimmed,
        changeTypes: selectedTypes,
        requestedByName: profile?.full_name || user!.email || "—",
        fromStatus: currentStatus,
      });

      // 3. Insert visible comment
      await supabase.from("budget_comments").insert({
        budget_id: budgetId,
        user_id: user!.id,
        body: `🔄 **Revisão solicitada:**\n${trimmed}`,
      } as any);

      toast.success("Solicitação de revisão enviada ao orçamentista.");
      onSuccess();
    } catch (err) {
      console.error("Revision request error:", err);
      toast.error("Erro ao enviar solicitação. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={submitting ? undefined : onOpenChange} modal>
      <DialogContent
        className="sm:max-w-lg"
        onPointerDownOutside={(e) => submitting && e.preventDefault()}
        onEscapeKeyDown={(e) => submitting && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <div className="p-1.5 rounded-md bg-warning/10">
              <RotateCcw className="h-4 w-4 text-warning" />
            </div>
            Solicitar Revisão ao Orçamentista
          </DialogTitle>
          <DialogDescription className="font-body">
            Descreva as alterações que o cliente solicitou. O orçamentista receberá estas instruções ao abrir o orçamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Change type checkboxes */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground">Tipo de alteração</Label>
            <div className="space-y-2">
              {CHANGE_TYPES.map((ct) => (
                <label
                  key={ct.value}
                  className="flex items-center gap-2.5 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedTypes.includes(ct.value)}
                    onCheckedChange={() => toggleType(ct.value)}
                  />
                  <span className="text-sm font-body text-foreground">{ct.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Instructions textarea */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">
              Instruções detalhadas para o orçamentista
              <span className="text-destructive ml-0.5">*</span>
            </Label>
            <Textarea
              value={instructions}
              onChange={(e) => {
                setInstructions(e.target.value);
                if (error) setError("");
              }}
              placeholder="Ex: O cliente quer remover a seção de marcenaria e incluir um closet no quarto principal. Ajustar o valor da seção de elétrica conforme cotação atualizada que enviei por e-mail."
              className="min-h-[120px] text-sm font-body resize-y"
              maxLength={1000}
            />
            <div className="flex items-center justify-between">
              {error && (
                <p className="text-xs text-destructive font-body">{error}</p>
              )}
              <span className="text-xs text-muted-foreground font-body ml-auto">
                {instructions.length} / 1000
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Enviar Solicitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
