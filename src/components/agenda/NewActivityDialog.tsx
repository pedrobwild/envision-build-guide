import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCreateActivity } from "@/hooks/useBudgetActivities";

interface NewActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pré-seleciona um negócio (opcional). */
  budgetId?: string;
  /** Pré-preenche tipo (call, email, meeting, task, followup, visit). */
  presetType?: string;
  /** Pré-preenche título. */
  presetTitle?: string;
}

const TYPES = [
  { value: "call", label: "Ligação" },
  { value: "email", label: "E-mail" },
  { value: "meeting", label: "Reunião" },
  { value: "visit", label: "Visita" },
  { value: "task", label: "Tarefa" },
  { value: "followup", label: "Follow-up" },
];

function defaultScheduled() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  // formato yyyy-MM-ddTHH:mm para input datetime-local
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NewActivityDialog({ open, onOpenChange, budgetId, presetType, presetTitle }: NewActivityDialogProps) {
  const [budget, setBudget] = useState<string>(budgetId ?? "");
  const [type, setType] = useState(presetType ?? "call");
  const [title, setTitle] = useState(presetTitle ?? "");
  const [description, setDescription] = useState("");
  const [scheduledFor, setScheduledFor] = useState(defaultScheduled());
  const create = useCreateActivity();

  // Lista de negócios ativos para selecionar (se não pré-selecionado)
  const { data: budgets = [] } = useQuery({
    queryKey: ["activity_budget_picker"],
    enabled: open && !budgetId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budgets")
        .select("id, sequential_code, client_name, project_name")
        .not("internal_status", "in", "(contrato_fechado,perdido,lost,archived)")
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (open) {
      setBudget(budgetId ?? "");
      setType(presetType ?? "call");
      setTitle(presetTitle ?? "");
      setDescription("");
      setScheduledFor(defaultScheduled());
    }
  }, [open, budgetId, presetType, presetTitle]);

  const canSave = useMemo(
    () => budget.length > 0 && title.trim().length > 0,
    [budget, title],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    await create.mutateAsync({
      budget_id: budget,
      type,
      title: title.trim(),
      description: description.trim() || null,
      scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Plus className="h-4 w-4 text-primary" />
            Nova atividade
          </DialogTitle>
          <DialogDescription className="text-xs">
            Agende uma ligação, reunião ou tarefa para um negócio.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          {!budgetId && (
            <div>
              <label className="text-xs font-body text-muted-foreground mb-1 block">Negócio *</label>
              <Select value={budget} onValueChange={setBudget}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar negócio" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {budgets.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.sequential_code ? `${b.sequential_code} · ` : ""}
                      {b.project_name || b.client_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-body text-muted-foreground mb-1 block">Tipo</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-body text-muted-foreground mb-1 block">Quando</label>
              <Input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-body text-muted-foreground mb-1 block">Título *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Ligar para apresentar proposta"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-body text-muted-foreground mb-1 block">
              Detalhes (opcional)
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Pontos a tratar, contexto, anotações…"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSave || create.isPending}>
              {create.isPending ? "Criando…" : "Criar atividade"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
