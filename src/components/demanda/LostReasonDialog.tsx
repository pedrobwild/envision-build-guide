import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { XCircle, Loader2 } from "lucide-react";

export type LostReasonCategory = "preco" | "escopo" | "concorrente" | "timing" | "sem_retorno" | "desistencia" | "outro";

export interface LostReasonPayload {
  reason_category: LostReasonCategory;
  reason_detail: string;
  competitor_name?: string;
  competitor_value?: number;
}

const CATEGORIES: { value: LostReasonCategory; label: string }[] = [
  { value: "preco", label: "Preço acima do orçado" },
  { value: "escopo", label: "Escopo / produto não atendeu" },
  { value: "concorrente", label: "Foi para concorrente" },
  { value: "timing", label: "Timing / prazo errado" },
  { value: "sem_retorno", label: "Cliente sumiu / sem retorno" },
  { value: "desistencia", label: "Desistência da reforma" },
  { value: "outro", label: "Outro motivo" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: LostReasonPayload) => Promise<void> | void;
}

export function LostReasonDialog({ open, onOpenChange, onConfirm }: Props) {
  const [category, setCategory] = useState<LostReasonCategory | "">("");
  const [detail, setDetail] = useState("");
  const [competitor, setCompetitor] = useState("");
  const [competitorValue, setCompetitorValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const showCompetitor = category === "concorrente";
  const canSubmit = !!category && (category !== "outro" || detail.trim().length > 0);

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onConfirm({
        reason_category: category as LostReasonCategory,
        reason_detail: detail.trim(),
        competitor_name: showCompetitor && competitor.trim() ? competitor.trim() : undefined,
        competitor_value:
          showCompetitor && competitorValue.trim()
            ? Number(competitorValue.replace(/\./g, "").replace(",", "."))
            : undefined,
      });
      onOpenChange(false);
      setCategory("");
      setDetail("");
      setCompetitor("");
      setCompetitorValue("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Marcar negócio como perdido
          </DialogTitle>
          <DialogDescription>
            Registre o motivo estruturado da perda. Esta informação alimenta a análise comercial.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="reason-category">Motivo principal *</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as LostReasonCategory)}>
              <SelectTrigger id="reason-category">
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showCompetitor && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="competitor-name">Concorrente</Label>
                <Input
                  id="competitor-name"
                  placeholder="Ex: Construtora X"
                  value={competitor}
                  onChange={(e) => setCompetitor(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="competitor-value">Valor da concorrência (R$)</Label>
                <Input
                  id="competitor-value"
                  inputMode="decimal"
                  placeholder="Ex: 150000"
                  value={competitorValue}
                  onChange={(e) => setCompetitorValue(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="reason-detail">
              Observações {category === "outro" && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              id="reason-detail"
              placeholder="Detalhes adicionais sobre a perda..."
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={3}
              maxLength={2000}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            Confirmar perda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
