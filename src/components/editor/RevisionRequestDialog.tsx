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
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useIsMobile } from "@/hooks/use-mobile";
import { logRevisionRequestEvent } from "@/lib/version-audit";
import { toast } from "sonner";

import { logger } from "@/lib/logger";

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

  const isComplement = currentStatus === "revision_requested";

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
      // 0. Buscar dados do orçamento para notificação (orçamentista, código, projeto)
      const { data: budgetData } = await supabase
        .from("budgets")
        .select("estimator_owner_id, sequential_code, project_name, client_name")
        .eq("id", budgetId)
        .maybeSingle();

      // 1. Atualizar status só se ainda não estiver em revision_requested (modo complemento mantém o status)
      if (!isComplement) {
        const { error: updateErr } = await supabase
          .from("budgets")
          .update({
            internal_status: "revision_requested",
            updated_at: new Date().toISOString(),
          })
          .eq("id", budgetId);

        if (updateErr) throw updateErr;
      } else {
        // Bump updated_at para deixar claro no histórico que houve nova solicitação
        await supabase
          .from("budgets")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", budgetId);
      }

      // 2. Log revision request event
      await logRevisionRequestEvent({
        budgetId,
        userId: user!.id,
        instructions: trimmed,
        changeTypes: selectedTypes,
        requestedByName: profile?.full_name || user!.email || "—",
        fromStatus: currentStatus,
        isComplement,
      });

      // 3. Insert visible comment
      const commentPrefix = isComplement ? "🔄 **Complemento da revisão:**" : "🔄 **Revisão solicitada:**";
      await supabase.from("budget_comments").insert({
        budget_id: budgetId,
        user_id: user!.id,
        body: `${commentPrefix}\n${trimmed}`,
      });

      // 4. Notificar orçamentista (in-app, realtime via NotificationBell)
      if (budgetData?.estimator_owner_id) {
        const requesterName = profile?.full_name || user!.email || "Comercial";
        const codeLabel = budgetData.sequential_code ? `${budgetData.sequential_code} · ` : "";
        const subject = budgetData.project_name || budgetData.client_name || "orçamento";
        const preview = trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
        const notifTitle = isComplement
          ? "Complemento na solicitação de revisão"
          : "Revisão solicitada pelo comercial";

        const { error: notifErr } = await supabase.from("notifications").insert({
          user_id: budgetData.estimator_owner_id,
          type: "revision_requested",
          title: notifTitle,
          message: `${codeLabel}${subject} · ${requesterName}: ${preview}`,
          budget_id: budgetId,
          read: false,
        });

        if (notifErr) {
          logger.error("Failed to insert revision notification:", notifErr);
        }
      }

      toast.success(
        isComplement
          ? "Complemento enviado ao orçamentista."
          : "Solicitação de revisão enviada ao orçamentista."
      );
      onSuccess();
    } catch (err) {
      logger.error("Revision request error:", err);
      toast.error("Erro ao enviar solicitação. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  const isMobile = useIsMobile();

  const titleNode = (
    <div className="flex items-center gap-2 font-display">
      <div className="p-1.5 rounded-md bg-warning/10">
        <RotateCcw className="h-4 w-4 text-warning" />
      </div>
      {isComplement ? "Complementar Solicitação de Revisão" : "Solicitar Revisão"}
    </div>
  );

  const descriptionText = isComplement
    ? "O cliente enviou mais informações? Acrescente aqui. A solicitação anterior continua válida e o orçamentista verá ambas no histórico."
    : "Descreva as alterações que o cliente solicitou. O orçamentista receberá estas instruções ao abrir o orçamento.";

  const body = (
    <div className="space-y-5 py-2">
      {/* Change type checkboxes */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-foreground">Tipo de alteração</Label>
        <div className="space-y-2">
          {CHANGE_TYPES.map((ct) => (
            <label
              key={ct.value}
              className="flex items-center gap-2.5 cursor-pointer min-h-[40px]"
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
          Instruções detalhadas
          <span className="text-destructive ml-0.5">*</span>
        </Label>
        <Textarea
          value={instructions}
          onChange={(e) => {
            setInstructions(e.target.value);
            if (error) setError("");
          }}
          placeholder="Ex: O cliente quer remover a seção de marcenaria e incluir um closet no quarto principal."
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
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={submitting ? undefined : onOpenChange}>
        <DrawerContent
          className="max-h-[92vh]"
          onPointerDownOutside={(e) => submitting && e.preventDefault()}
          onEscapeKeyDown={(e) => submitting && e.preventDefault()}
        >
          <DrawerHeader className="text-left">
            <DrawerTitle>{titleNode}</DrawerTitle>
            <DrawerDescription className="font-body text-sm">
              {descriptionText}
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 overflow-y-auto">{body}</div>
          <DrawerFooter
            className="flex flex-col gap-2 pt-2"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
          >
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isComplement ? "Enviar Complemento" : "Enviar Solicitação"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="w-full h-10"
            >
              Cancelar
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={submitting ? undefined : onOpenChange} modal>
      <DialogContent
        className="sm:max-w-lg"
        onPointerDownOutside={(e) => submitting && e.preventDefault()}
        onEscapeKeyDown={(e) => submitting && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{titleNode}</DialogTitle>
          <DialogDescription className="font-body">
            {descriptionText}
          </DialogDescription>
        </DialogHeader>

        {body}

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
            {isComplement ? "Enviar Complemento" : "Enviar Solicitação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
