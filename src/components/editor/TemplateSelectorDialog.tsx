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
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { LayoutTemplate, Loader2, Check, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useBudgetTemplates } from "@/hooks/useBudgetTemplates";
import { seedFromTemplate, type SeedProgress } from "@/lib/seed-from-template";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { logger } from "@/lib/logger";

interface TemplateSelectorDialogProps {
  open: boolean;
  budgetId: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function TemplateSelectorDialog({
  open,
  budgetId,
  onOpenChange,
  onConfirm,
}: TemplateSelectorDialogProps) {
  const { data: templates = [], isLoading: templatesLoading } = useBudgetTemplates();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState<SeedProgress>({ phase: "", percent: 0 });
  const [hasExistingSections, setHasExistingSections] = useState<boolean | null>(null);

  const handleOpen = async (isOpen: boolean) => {
    if (isOpen && budgetId) {
      const { count } = await supabase
        .from("sections")
        .select("id", { count: "exact", head: true })
        .eq("budget_id", budgetId);
      setHasExistingSections((count ?? 0) > 0);
      setSelectedId(null);
      setDone(false);
      setProgress({ phase: "", percent: 0 });
    }
    onOpenChange(isOpen);
  };

  const handleConfirm = async () => {
    if (!selectedId) return;
    setSeeding(true);
    setDone(false);
    setProgress({ phase: "Iniciando…", percent: 0 });
    try {
      const tplArg = selectedId === "default" ? null : selectedId;
      await seedFromTemplate(budgetId, tplArg, (p) => setProgress(p));
      setProgress({ phase: "Pronto! Você já pode editar e atribuir responsável.", percent: 100 });
      setDone(true);
      toast.success(selectedId === "default"
        ? "Seções padrão aplicadas!"
        : "Template aplicado com sucesso!");
    } catch (err) {
      logger.error("Erro ao aplicar template:", err);
      toast.error("Erro ao aplicar template.");
      setSeeding(false);
    }
  };

  const handleClose = () => {
    if (done) onConfirm();
    onOpenChange(false);
    // reset locais para próxima abertura
    setSeeding(false);
    setDone(false);
  };

  const showProgressView = seeding || done;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? handleOpen(o) : handleClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <LayoutTemplate className="h-4 w-4 text-primary" />
            </div>
            {showProgressView ? "Aplicando template" : "Aplicar Template"}
          </DialogTitle>
          <DialogDescription className="text-sm font-body">
            {showProgressView
              ? "Estamos preparando seu orçamento. Não feche esta janela até concluir."
              : "Selecione um modelo base para iniciar o orçamento."}
          </DialogDescription>
        </DialogHeader>

        {showProgressView ? (
          /* ── Painel de progresso ───────────────────────────────────────── */
          <div
            className="py-4 space-y-4"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="flex items-center gap-3">
              {done ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              ) : (
                <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
              )}
              <p className="text-sm font-body text-foreground break-words min-w-0">
                {progress.phase || "Iniciando…"}
              </p>
            </div>
            <Progress
              value={typeof progress.percent === "number" ? progress.percent : undefined}
              className="h-2"
            />
            <p className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground text-right">
              {typeof progress.percent === "number" ? `${progress.percent}%` : "Processando…"}
            </p>
            {!done && (
              <p className="text-xs font-body text-muted-foreground">
                Assim que terminar, o editor recarrega as seções e você poderá ajustar itens, atribuir responsável e definir prazo.
              </p>
            )}
          </div>
        ) : (
          /* ── Seleção de template ───────────────────────────────────────── */
          <>
            {hasExistingSections && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm font-body">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <span className="text-foreground">
                  Este orçamento já possui seções. Aplicar um template irá <strong>substituir todas as seções e itens existentes</strong>.
                </span>
              </div>
            )}

            <ScrollArea className="max-h-[350px] pr-2">
              <div className="space-y-2 py-2">
                {/* Default sections option */}
                <Card
                  className={`p-3 cursor-pointer transition-all border-2 ${
                    selectedId === "default"
                      ? "border-primary bg-primary/5"
                      : "border-transparent hover:border-border"
                  }`}
                  onClick={() => setSelectedId("default")}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                      selectedId === "default" ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}>
                      {selectedId === "default" ? <Check className="h-4 w-4" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold font-display">Seções padrão</p>
                      <p className="text-xs text-muted-foreground font-body">Usar a estrutura padrão de seções</p>
                    </div>
                  </div>
                </Card>

                {/* Template options */}
                {templatesLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  templates.map((t) => (
                    <Card
                      key={t.id}
                      className={`p-3 cursor-pointer transition-all border-2 ${
                        selectedId === t.id
                          ? "border-primary bg-primary/5"
                          : "border-transparent hover:border-border"
                      }`}
                      onClick={() => setSelectedId(t.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                          selectedId === t.id ? "bg-primary text-primary-foreground" : "bg-muted"
                        }`}>
                          {selectedId === t.id ? <Check className="h-4 w-4" /> : <LayoutTemplate className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold font-display">{t.name}</p>
                            <Badge variant="secondary" className="text-[10px]">Template</Badge>
                          </div>
                          {t.description && (
                            <p className="text-xs text-muted-foreground font-body mt-0.5 line-clamp-2">{t.description}</p>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          {showProgressView ? (
            <Button onClick={handleClose} disabled={!done} className="gap-2">
              {done ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Continuar editando
                </>
              ) : (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Aplicando…
                </>
              )}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleConfirm} disabled={!selectedId}>
                {hasExistingSections ? "Substituir e aplicar" : "Aplicar e iniciar"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
