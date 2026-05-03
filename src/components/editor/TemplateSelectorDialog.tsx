import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { LayoutTemplate, Loader2, Check, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useBudgetTemplates } from "@/hooks/useBudgetTemplates";
import { seedFromTemplate, type SeedProgress } from "@/lib/seed-from-template";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const isMobile = useIsMobile();

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

  const titleNode = (
    <div className="flex items-center gap-2 font-display">
      <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
        <LayoutTemplate className="h-4 w-4 text-primary" />
      </div>
      {showProgressView ? "Aplicando template" : "Aplicar Template"}
    </div>
  );

  const descriptionText = showProgressView
    ? "Estamos preparando seu orçamento. Não feche esta janela até concluir."
    : "Selecione um modelo base para iniciar o orçamento.";

  const body = showProgressView ? (
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

      <ScrollArea className={isMobile ? "max-h-[55vh] pr-1" : "max-h-[350px] pr-2"}>
        <div className="space-y-2 py-2">
          {/* Default sections option */}
          <Card
            className={`p-3 cursor-pointer active:scale-[0.99] transition-all border-2 ${
              selectedId === "default"
                ? "border-primary bg-primary/5"
                : "border-transparent hover:border-border"
            }`}
            onClick={() => setSelectedId("default")}
            role="radio"
            aria-checked={selectedId === "default"}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedId("default"); }}
          >
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
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
                className={`p-3 cursor-pointer active:scale-[0.99] transition-all border-2 ${
                  selectedId === t.id
                    ? "border-primary bg-primary/5"
                    : "border-transparent hover:border-border"
                }`}
                onClick={() => setSelectedId(t.id)}
                role="radio"
                aria-checked={selectedId === t.id}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedId(t.id); }}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                    selectedId === t.id ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}>
                    {selectedId === t.id ? <Check className="h-4 w-4" /> : <LayoutTemplate className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
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
  );

  const primaryButton = showProgressView ? (
    <Button onClick={handleClose} disabled={!done} className="gap-2 w-full sm:w-auto h-11 sm:h-10">
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
    <Button onClick={handleConfirm} disabled={!selectedId} className="w-full sm:w-auto h-11 sm:h-10">
      {hasExistingSections ? "Substituir e aplicar" : "Aplicar e iniciar"}
    </Button>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(o) => (o ? handleOpen(o) : handleClose())}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>{titleNode}</DrawerTitle>
            <DrawerDescription className="text-sm font-body">
              {descriptionText}
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 overflow-y-auto">{body}</div>
          <DrawerFooter
            className="flex flex-col gap-2 pt-2"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
          >
            {primaryButton}
            {!showProgressView && (
              <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full h-10">
                Cancelar
              </Button>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? handleOpen(o) : handleClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{titleNode}</DialogTitle>
          <DialogDescription className="text-sm font-body">
            {descriptionText}
          </DialogDescription>
        </DialogHeader>

        {body}

        <DialogFooter>
          {showProgressView ? (
            primaryButton
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              {primaryButton}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
