import { useEffect, useMemo, useState } from "react";
import { Plus, Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useIsMobile } from "@/hooks/use-mobile";

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

const QUICK_DATES = [
  { label: "Hoje 18h", offsetHours: 0, hour: 18 },
  { label: "Amanhã 9h", offsetHours: 24, hour: 9 },
  { label: "+2 dias", offsetHours: 48, hour: 9 },
  { label: "+1 sem.", offsetHours: 168, hour: 9 },
];

function pad(n: number) { return String(n).padStart(2, "0"); }
function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultScheduled() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return toLocalInput(d);
}

export function NewActivityDialog({ open, onOpenChange, budgetId, presetType, presetTitle }: NewActivityDialogProps) {
  const [budget, setBudget] = useState<string>(budgetId ?? "");
  const [type, setType] = useState(presetType ?? "call");
  const [title, setTitle] = useState(presetTitle ?? "");
  const [description, setDescription] = useState("");
  const [scheduledFor, setScheduledFor] = useState(defaultScheduled());
  const create = useCreateActivity();
  const isMobile = useIsMobile();

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

  function applyQuick(offsetHours: number, hour: number) {
    const d = new Date();
    d.setHours(d.getHours() + offsetHours);
    if (offsetHours > 0 || d.getHours() >= hour) {
      d.setHours(hour, 0, 0, 0);
    }
    setScheduledFor(toLocalInput(d));
  }

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

  const titleNode = (
    <span className="flex items-center gap-2 font-display">
      <Plus className="h-4 w-4 text-primary" />
      Nova atividade
    </span>
  );

  const descriptionText = "Agende uma ligação, reunião ou tarefa para um negócio.";

  const formBody = (
    <form id="new-activity-form" onSubmit={handleSubmit} className="space-y-3.5">
      {!budgetId && (
        <div className="space-y-1.5">
          <Label className="text-xs">Negócio *</Label>
          <Select value={budget} onValueChange={setBudget}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Selecionar negócio" />
            </SelectTrigger>
            <SelectContent className="max-h-[60vh] sm:max-h-72">
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

      <div className="space-y-1.5">
        <Label className="text-xs">Tipo</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-10">
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

      <div className="space-y-1.5">
        <Label htmlFor="activity-due" className="text-xs">Prazo</Label>
        <Input
          id="activity-due"
          type="datetime-local"
          value={scheduledFor}
          onChange={(e) => setScheduledFor(e.target.value)}
          className="h-10"
        />
        <div className="flex gap-1.5 flex-wrap pt-1">
          {QUICK_DATES.map((q) => (
            <Button
              key={q.label}
              type="button"
              size="sm"
              variant="outline"
              className="h-9 text-[11px] px-2.5"
              onClick={() => applyQuick(q.offsetHours, q.hour)}
            >
              {q.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="activity-title" className="text-xs">Título *</Label>
        <Input
          id="activity-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Ligar para apresentar proposta"
          autoFocus
          className="h-10"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="activity-desc" className="text-xs">
          Detalhes (opcional)
        </Label>
        <Textarea
          id="activity-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Pontos a tratar, contexto, anotações…"
        />
      </div>
    </form>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>{titleNode}</DrawerTitle>
            <DrawerDescription className="text-xs">{descriptionText}</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 overflow-y-auto">{formBody}</div>
          <DrawerFooter
            className="flex flex-col gap-2 pt-2"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
          >
            <Button
              type="submit"
              form="new-activity-form"
              disabled={!canSave || create.isPending}
              className="w-full h-11 gap-2"
            >
              {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {create.isPending ? "Criando…" : "Criar atividade"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{titleNode}</DialogTitle>
          <DialogDescription className="text-xs">{descriptionText}</DialogDescription>
        </DialogHeader>

        {formBody}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="new-activity-form" disabled={!canSave || create.isPending}>
            {create.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            {create.isPending ? "Criando…" : "Criar atividade"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
