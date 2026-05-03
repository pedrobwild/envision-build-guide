import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateActivity } from "@/hooks/useBudgetActivities";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2 } from "lucide-react";

export interface ActivityInitialValues {
  type?: string;
  title?: string;
  description?: string;
  /** Offset em horas a partir de "agora" para o prazo. */
  scheduledOffsetHours?: number;
  /** Hora do dia (0-23) para o prazo, aplicada após o offset. */
  scheduledHour?: number;
}

interface Props {
  budgetId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  initialValues?: ActivityInitialValues | null;
}

const ACTIVITY_TYPES = [
  { value: "task", label: "Tarefa" },
  { value: "call", label: "Ligação" },
  { value: "email", label: "E-mail" },
  { value: "meeting", label: "Reunião" },
  { value: "followup", label: "Follow-up" },
  { value: "visit", label: "Visita" },
];

const QUICK_DATES = [
  { label: "Hoje 18h", offsetHours: 0, hour: 18 },
  { label: "Amanhã 9h", offsetHours: 24, hour: 9 },
  { label: "+2 dias", offsetHours: 48, hour: 9 },
  { label: "+1 semana", offsetHours: 168, hour: 9 },
];

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildDate(offsetHours: number, hour?: number) {
  const d = new Date();
  d.setHours(d.getHours() + offsetHours);
  if (typeof hour === "number") d.setHours(hour, 0, 0, 0);
  return d;
}

export function NewBudgetActivityDialog({
  budgetId,
  open,
  onOpenChange,
  onCreated,
  initialValues,
}: Props) {
  const [type, setType] = useState("task");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledFor, setScheduledFor] = useState<string>("");
  const create = useCreateActivity();
  const isMobile = useIsMobile();

  // Aplica os valores iniciais sempre que o dialog abre com um template.
  useEffect(() => {
    if (!open) return;
    if (initialValues) {
      setType(initialValues.type ?? "task");
      setTitle(initialValues.title ?? "");
      setDescription(initialValues.description ?? "");
      if (typeof initialValues.scheduledOffsetHours === "number") {
        setScheduledFor(
          toLocalInputValue(
            buildDate(initialValues.scheduledOffsetHours, initialValues.scheduledHour),
          ),
        );
      } else {
        setScheduledFor("");
      }
    }
  }, [open, initialValues]);

  function applyQuick(offsetHours: number, hour: number) {
    const d = new Date();
    d.setHours(d.getHours() + offsetHours);
    if (offsetHours > 0 || d.getHours() >= hour) {
      d.setHours(hour, 0, 0, 0);
    }
    setScheduledFor(toLocalInputValue(d));
  }

  function reset() {
    setType("task");
    setTitle("");
    setDescription("");
    setScheduledFor("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await create.mutateAsync({
      budget_id: budgetId,
      type,
      title: title.trim(),
      description: description.trim() || null,
      scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : null,
    });
    reset();
    onCreated?.();
    onOpenChange(false);
  }

  const formBody = (
    <form id="new-budget-activity-form" onSubmit={handleSubmit} className="space-y-3.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="bact-type" className="text-xs">Tipo</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="bact-type" className="h-10 sm:h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bact-due" className="text-xs">Prazo</Label>
          <Input
            id="bact-due"
            type="datetime-local"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            className="h-10 sm:h-9"
          />
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {QUICK_DATES.map((q) => (
          <Button
            key={q.label}
            type="button"
            size="sm"
            variant="outline"
            className="h-9 sm:h-7 text-[11px] sm:text-[10px] px-2.5 sm:px-2"
            onClick={() => applyQuick(q.offsetHours, q.hour)}
          >
            {q.label}
          </Button>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bact-title" className="text-xs">Título *</Label>
        <Input
          id="bact-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex.: Ligar para confirmar visita"
          required
          autoFocus
          className="h-10 sm:h-9"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bact-desc" className="text-xs">Descrição (opcional)</Label>
        <Textarea
          id="bact-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Detalhes, contexto, links..."
          rows={3}
        />
      </div>
    </form>
  );

  const titleText = "Nova ação";
  const descriptionText = "Crie uma tarefa, ligação ou follow-up com prazo para este negócio.";

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>{titleText}</DrawerTitle>
            <DrawerDescription>{descriptionText}</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 overflow-y-auto">{formBody}</div>
          <DrawerFooter
            className="flex flex-col gap-2 pt-2"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
          >
            <Button
              type="submit"
              form="new-budget-activity-form"
              disabled={create.isPending || !title.trim()}
              className="w-full h-11 gap-2"
            >
              {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar ação
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={create.isPending}
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
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{titleText}</DialogTitle>
          <DialogDescription>{descriptionText}</DialogDescription>
        </DialogHeader>

        {formBody}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={create.isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" form="new-budget-activity-form" disabled={create.isPending || !title.trim()}>
            {create.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Criar ação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
