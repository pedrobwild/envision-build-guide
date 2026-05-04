import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ListChecks,
  RotateCcw,
  UserCog,
  Handshake,
  X,
  Loader2,
} from "lucide-react";
import {
  INTERNAL_STATUSES,
  type InternalStatus,
} from "@/lib/role-constants";

interface ProfileOption {
  id: string;
  full_name: string;
}

interface BulkActionsBarProps {
  count: number;
  onClear: () => void;
  isAdmin: boolean;
  estimatorOptions: ProfileOption[];
  commercialOptions: ProfileOption[];
  onBulkStatus: (status: InternalStatus) => Promise<void> | void;
  onBulkRevision: (instructions: string) => Promise<void> | void;
  onBulkAssign: (
    type: "estimator" | "commercial",
    userId: string | null,
  ) => Promise<void> | void;
}

const CHANGE_TYPES = [
  { value: "inclusion", label: "Inclusão de itens ou escopo" },
  { value: "removal", label: "Remoção de itens ou escopo" },
  { value: "price", label: "Revisão de preços" },
  { value: "scope", label: "Alteração de especificações técnicas" },
  { value: "other", label: "Outro" },
] as const;

// Status disponíveis em ações em lote no painel de produção do orçamentista.
// Termina em "delivered_to_sales" — a transição "Enviar ao Cliente" é exclusiva do comercial.
const ELABORATION_STATUS_OPTIONS_VALUES: InternalStatus[] = [
  "novo",
  "requested",
  "triage",
  "assigned",
  "in_progress",
  "waiting_info",
  "ready_for_review",
  "revision_requested",
  "delivered_to_sales",
];

const STATUS_OPTIONS = ELABORATION_STATUS_OPTIONS_VALUES.map((s) => ({
  value: s,
  label: `${INTERNAL_STATUSES[s].icon} ${INTERNAL_STATUSES[s].label}`,
}));

export function BulkActionsBar({
  count,
  onClear,
  isAdmin,
  estimatorOptions,
  commercialOptions,
  onBulkStatus,
  onBulkRevision,
  onBulkAssign,
}: BulkActionsBarProps) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState<null | "estimator" | "commercial">(null);

  const [pendingStatus, setPendingStatus] = useState<InternalStatus | "">("");
  const [pendingAssignee, setPendingAssignee] = useState<string>("");
  const [revisionTypes, setRevisionTypes] = useState<string[]>([]);
  const [revisionText, setRevisionText] = useState("");
  const [revisionError, setRevisionError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function toggleType(value: string) {
    setRevisionTypes((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value],
    );
  }

  async function handleStatusConfirm() {
    if (!pendingStatus) return;
    setSubmitting(true);
    try {
      await onBulkStatus(pendingStatus as InternalStatus);
      setStatusOpen(false);
      setPendingStatus("");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevisionConfirm() {
    const trimmed = revisionText.trim();
    if (trimmed.length < 20) {
      setRevisionError("As instruções devem ter pelo menos 20 caracteres.");
      return;
    }
    setRevisionError("");
    setSubmitting(true);
    try {
      const typesPrefix =
        revisionTypes.length > 0
          ? `Tipos: ${revisionTypes
              .map((v) => CHANGE_TYPES.find((c) => c.value === v)?.label ?? v)
              .join(", ")}\n\n`
          : "";
      await onBulkRevision(`${typesPrefix}${trimmed}`);
      setRevisionOpen(false);
      setRevisionTypes([]);
      setRevisionText("");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssignConfirm() {
    if (!assignOpen) return;
    const target = pendingAssignee === "__none__" ? null : pendingAssignee || null;
    setSubmitting(true);
    try {
      await onBulkAssign(assignOpen, target);
      setAssignOpen(null);
      setPendingAssignee("");
    } finally {
      setSubmitting(false);
    }
  }

  const assigneeOptions =
    assignOpen === "estimator" ? estimatorOptions : commercialOptions;

  return (
    <>
      {/*
        Sticky bottom bar. Em mobile precisa pairar acima do AdminBottomNav
        (~4rem) + safe-area do iOS; em desktop cola no rodapé.
      */}
      <div
        className="fixed inset-x-0 bottom-16 lg:bottom-0 z-40 px-2 sm:px-3 pointer-events-none"
        style={{
          paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div
          className="mx-auto max-w-4xl pointer-events-auto rounded-xl border border-border bg-card/95 backdrop-blur shadow-lg"
          role="region"
          aria-label={`${count} orçamento${count === 1 ? "" : "s"} selecionado${count === 1 ? "" : "s"}`}
        >
          <div className="flex items-center gap-1.5 px-2.5 py-2 sm:gap-2 sm:px-3 overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-2 pr-2 border-r border-border shrink-0">
              <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md bg-primary text-primary-foreground text-xs font-mono font-semibold">
                {count}
              </span>
              <span className="text-xs font-body text-muted-foreground hidden sm:inline">
                selecionado{count !== 1 ? "s" : ""}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="h-9 sm:h-8 gap-1.5 text-xs shrink-0"
              onClick={() => setStatusOpen(true)}
            >
              <ListChecks className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Alterar status</span>
              <span className="sm:hidden">Status</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-9 sm:h-8 gap-1.5 text-xs text-warning border-warning/30 hover:bg-warning/10 shrink-0"
              onClick={() => setRevisionOpen(true)}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Solicitar revisão</span>
              <span className="sm:hidden">Revisão</span>
            </Button>

            {isAdmin && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 sm:h-8 gap-1.5 text-xs shrink-0"
                  onClick={() => setAssignOpen("estimator")}
                >
                  <UserCog className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Reatribuir orçamentista</span>
                  <span className="sm:hidden">Orçam.</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 sm:h-8 gap-1.5 text-xs shrink-0"
                  onClick={() => setAssignOpen("commercial")}
                >
                  <Handshake className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Reatribuir comercial</span>
                  <span className="sm:hidden">Comerc.</span>
                </Button>
              </>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 sm:h-8 sm:w-8 shrink-0 sm:ml-auto"
              onClick={onClear}
              aria-label="Limpar seleção"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Status dialog */}
      <Dialog
        open={statusOpen}
        onOpenChange={(o) => !submitting && setStatusOpen(o)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Alterar status em lote</DialogTitle>
            <DialogDescription className="font-body">
              O novo status será aplicado a {count} orçamento{count !== 1 ? "s" : ""}.
              Transições inválidas para alguns itens podem ser ignoradas pelo banco.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Novo status
            </Label>
            <Select
              value={pendingStatus}
              onValueChange={(v) => setPendingStatus(v as InternalStatus)}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Selecione um status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setStatusOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleStatusConfirm}
              disabled={!pendingStatus || submitting}
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Aplicar a {count}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revision dialog */}
      <Dialog
        open={revisionOpen}
        onOpenChange={(o) => !submitting && setRevisionOpen(o)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <div className="p-1.5 rounded-md bg-warning/10">
                <RotateCcw className="h-4 w-4 text-warning" />
              </div>
              Solicitar revisão em lote
            </DialogTitle>
            <DialogDescription className="font-body">
              As mesmas instruções serão enviadas a {count} orçamento
              {count !== 1 ? "s" : ""}. Cada orçamentista responsável recebe a
              notificação.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                Tipo de alteração
              </Label>
              <div className="space-y-2">
                {CHANGE_TYPES.map((ct) => (
                  <label
                    key={ct.value}
                    className="flex items-center gap-2.5 cursor-pointer"
                  >
                    <Checkbox
                      checked={revisionTypes.includes(ct.value)}
                      onCheckedChange={() => toggleType(ct.value)}
                    />
                    <span className="text-sm font-body text-foreground">
                      {ct.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                Instruções detalhadas
                <span className="text-destructive ml-0.5">*</span>
              </Label>
              <Textarea
                value={revisionText}
                onChange={(e) => {
                  setRevisionText(e.target.value);
                  if (revisionError) setRevisionError("");
                }}
                placeholder="Descreva as alterações necessárias. Estas instruções serão aplicadas a todos os orçamentos selecionados."
                className="min-h-[120px] text-sm font-body resize-y"
                maxLength={1000}
              />
              <div className="flex items-center justify-between">
                {revisionError && (
                  <p className="text-xs text-destructive font-body">
                    {revisionError}
                  </p>
                )}
                <span className="text-xs text-muted-foreground font-body ml-auto">
                  {revisionText.length} / 1000
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRevisionOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleRevisionConfirm}
              disabled={submitting}
              className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Enviar a {count}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign dialog */}
      <Dialog
        open={!!assignOpen}
        onOpenChange={(o) => !submitting && !o && setAssignOpen(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              Reatribuir{" "}
              {assignOpen === "estimator" ? "orçamentista" : "comercial"} em lote
            </DialogTitle>
            <DialogDescription className="font-body">
              Será aplicado a {count} orçamento{count !== 1 ? "s" : ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Novo responsável
            </Label>
            <Select value={pendingAssignee} onValueChange={setPendingAssignee}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Sem responsável —</SelectItem>
                {assigneeOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name || p.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setAssignOpen(null)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAssignConfirm}
              disabled={!pendingAssignee || submitting}
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Aplicar a {count}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
