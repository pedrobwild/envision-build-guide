import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, PauseCircle, AlertOctagon } from "lucide-react";
import type { InternalStatus } from "@/lib/role-constants";

const STATUS_META: Record<string, { title: string; desc: string; icon: React.ReactNode; placeholder: string }> = {
  waiting_info: {
    title: "Marcar como Aguardando",
    desc: "Informe o que está faltando para continuar a produção.",
    icon: <PauseCircle className="h-5 w-5 text-amber-600" />,
    placeholder: "Ex: Faltam medidas do banheiro da suíte…",
  },
};

interface BlockingDialogProps {
  open: boolean;
  targetStatus: "waiting_info" | null;
  onConfirm: (status: InternalStatus, note: string) => Promise<void>;
  onCancel: () => void;
}

export function BlockingDialog({ open, targetStatus, onConfirm, onCancel }: BlockingDialogProps) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const meta = targetStatus ? STATUS_META[targetStatus] : null;

  async function handleConfirm() {
    if (!targetStatus || !note.trim()) return;
    setSubmitting(true);
    await onConfirm(targetStatus, note.trim());
    setNote("");
    setSubmitting(false);
  }

  function handleCancel() {
    setNote("");
    onCancel();
  }

  if (!meta) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-base">
            {meta.icon} {meta.title}
          </DialogTitle>
          <DialogDescription className="font-body text-sm">
            {meta.desc}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={meta.placeholder}
          rows={3}
          maxLength={1000}
          className="text-sm"
          autoFocus
        />
        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={handleCancel} disabled={submitting}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={!note.trim() || submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
