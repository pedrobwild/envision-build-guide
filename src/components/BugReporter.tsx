import { useState, useCallback, useMemo } from "react";
import { Bug, ChevronRight, ChevronLeft, Loader2, Check, AlertTriangle, Smartphone, Monitor, Tablet, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useDeviceContext } from "@/hooks/useDeviceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Step = "describe" | "reproduce" | "context" | "submitting" | "done";
type Severity = "low" | "normal" | "high" | "critical";

const SEVERITY_LABEL: Record<Severity, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  critical: "Crítica",
};

const SEVERITY_COLOR: Record<Severity, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-primary/10 text-primary",
  high: "bg-warning/15 text-warning",
  critical: "bg-destructive/15 text-destructive",
};

interface BugReporterProps {
  /** Renderiza o FAB (default true). Quando false, o componente expõe apenas o trigger controlado por `open`. */
  showFab?: boolean;
}

/**
 * Reportador de bugs em-app, otimizado para mobile.
 *
 * Fluxo guiado em 3 etapas:
 *  1. Descrever — título + descrição + severidade
 *  2. Reproduzir — passos, comportamento esperado/atual
 *  3. Contexto — pré-visualização do que será enviado (device, rota, filtros, console)
 *
 * O contexto técnico é coletado automaticamente via `useDeviceContext` e enviado
 * junto do report para a tabela `bug_reports`. O usuário não precisa abrir DevTools.
 */
export function BugReporter({ showFab = true }: BugReporterProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("describe");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("normal");
  const [stepsToReproduce, setStepsToReproduce] = useState("");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");

  const { user } = useAuth();
  const { profile } = useUserProfile();
  const collectContext = useDeviceContext();

  const reset = useCallback(() => {
    setStep("describe");
    setTitle("");
    setDescription("");
    setSeverity("normal");
    setStepsToReproduce("");
    setExpected("");
    setActual("");
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    // Atrasa o reset para a animação fechar antes
    setTimeout(reset, 250);
  }, [reset]);

  const canAdvanceFromDescribe = title.trim().length >= 4 && description.trim().length >= 10;
  const canAdvanceFromReproduce = stepsToReproduce.trim().length >= 5;

  const submit = useCallback(async () => {
    setStep("submitting");
    try {
      const ctx = collectContext();
      const { error } = await supabase.from("bug_reports").insert([
        {
          title: title.trim(),
          description: description.trim(),
          severity,
          steps_to_reproduce: stepsToReproduce.trim() || null,
          expected_behavior: expected.trim() || null,
          actual_behavior: actual.trim() || null,
          reporter_id: user?.id ?? null,
          reporter_name: profile?.full_name ?? null,
          reporter_email: user?.email ?? null,
          user_role: ctx.userRole,
          route: ctx.route,
          device_type: ctx.deviceType,
          os_name: ctx.osName,
          browser_name: ctx.browserName,
          browser_version: ctx.browserVersion,
          viewport_width: ctx.viewportWidth,
          viewport_height: ctx.viewportHeight,
          device_pixel_ratio: ctx.devicePixelRatio,
          user_agent: ctx.userAgent,
          active_filters: ctx.activeFilters as never,
          console_errors: ctx.consoleErrors as never,
        },
      ]);
      if (error) throw error;
      setStep("done");
      toast.success("Bug reportado", { description: "Obrigado! O time vai analisar." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error("Não foi possível enviar o bug", { description: msg });
      setStep("context");
    }
  }, [collectContext, title, description, severity, stepsToReproduce, expected, actual, user, profile]);

  return (
    <>
      {showFab && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Reportar um bug"
          title="Reportar um bug"
          className={cn(
            "fixed z-40 bottom-20 right-4 lg:bottom-6 lg:right-6",
            "h-12 w-12 rounded-full shadow-lg",
            "bg-card border border-border/80 text-muted-foreground",
            "hover:text-destructive hover:border-destructive/40 hover:bg-destructive/5",
            "active:scale-95 transition-all flex items-center justify-center",
          )}
        >
          <Bug className="h-5 w-5" />
        </button>
      )}

      <Drawer open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="border-b border-border/60 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <DrawerTitle className="flex items-center gap-2 text-base">
                  <Bug className="h-4 w-4 text-destructive" />
                  Reportar um bug
                </DrawerTitle>
                <DrawerDescription className="text-xs">
                  {step === "describe" && "Conte o que aconteceu"}
                  {step === "reproduce" && "Como reproduzir esse problema?"}
                  {step === "context" && "Contexto técnico anexado automaticamente"}
                  {step === "submitting" && "Enviando..."}
                  {step === "done" && "Pronto! Obrigado pelo report."}
                </DrawerDescription>
              </div>
              <StepIndicator step={step} />
            </div>
          </DrawerHeader>

          <ScrollArea className="px-4 py-4 max-h-[60vh]">
            <AnimatePresence mode="wait" initial={false}>
              {step === "describe" && (
                <Section key="describe">
                  <Field label="Título curto" required>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex.: Cards do kanban ficam cortados no iPhone"
                      maxLength={140}
                      autoFocus
                    />
                  </Field>
                  <Field label="Descrição" required hint="O que você esperava que acontecesse vs. o que viu?">
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Descreva o problema em uma ou duas frases."
                      rows={4}
                      maxLength={1000}
                    />
                  </Field>
                  <Field label="Severidade">
                    <Select value={severity} onValueChange={(v) => setSeverity(v as Severity)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baixa — incômodo cosmético</SelectItem>
                        <SelectItem value="normal">Normal — atrapalha mas dá pra contornar</SelectItem>
                        <SelectItem value="high">Alta — bloqueia uma tarefa importante</SelectItem>
                        <SelectItem value="critical">Crítica — sistema parado / risco financeiro</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </Section>
              )}

              {step === "reproduce" && (
                <Section key="reproduce">
                  <Field label="Passos para reproduzir" required hint="Numere os passos. Mais detalhe = correção mais rápida.">
                    <Textarea
                      value={stepsToReproduce}
                      onChange={(e) => setStepsToReproduce(e.target.value)}
                      placeholder={"1. Acessar /admin/comercial no celular\n2. Tocar no chip 'Em Elaboração'\n3. Tentar arrastar um card"}
                      rows={5}
                      autoFocus
                    />
                  </Field>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Comportamento esperado">
                      <Textarea
                        value={expected}
                        onChange={(e) => setExpected(e.target.value)}
                        placeholder="O que deveria acontecer"
                        rows={3}
                      />
                    </Field>
                    <Field label="Comportamento observado">
                      <Textarea
                        value={actual}
                        onChange={(e) => setActual(e.target.value)}
                        placeholder="O que de fato aconteceu"
                        rows={3}
                      />
                    </Field>
                  </div>
                </Section>
              )}

              {step === "context" && <ContextPreview key="context" collectContext={collectContext} severity={severity} />}

              {step === "submitting" && (
                <div key="submitting" className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Enviando seu report...</p>
                </div>
              )}

              {step === "done" && (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-10 text-center gap-3"
                >
                  <div className="h-14 w-14 rounded-full bg-success/15 flex items-center justify-center">
                    <Check className="h-7 w-7 text-success" />
                  </div>
                  <h3 className="font-display font-semibold text-base">Report enviado!</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    O time recebeu seu report com todo o contexto técnico anexado. Obrigado!
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </ScrollArea>

          <DrawerFooter className="border-t border-border/60 pt-3">
            {step === "describe" && (
              <div className="flex items-center justify-between gap-2">
                <Button variant="ghost" size="sm" onClick={close}>
                  <X className="h-4 w-4 mr-1.5" />Cancelar
                </Button>
                <Button
                  size="sm"
                  disabled={!canAdvanceFromDescribe}
                  onClick={() => setStep("reproduce")}
                >
                  Próximo<ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
            {step === "reproduce" && (
              <div className="flex items-center justify-between gap-2">
                <Button variant="ghost" size="sm" onClick={() => setStep("describe")}>
                  <ChevronLeft className="h-4 w-4 mr-1" />Voltar
                </Button>
                <Button
                  size="sm"
                  disabled={!canAdvanceFromReproduce}
                  onClick={() => setStep("context")}
                >
                  Revisar<ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
            {step === "context" && (
              <div className="flex items-center justify-between gap-2">
                <Button variant="ghost" size="sm" onClick={() => setStep("reproduce")}>
                  <ChevronLeft className="h-4 w-4 mr-1" />Voltar
                </Button>
                <Button size="sm" onClick={submit}>
                  Enviar report
                </Button>
              </div>
            )}
            {step === "done" && (
              <Button onClick={close} className="w-full">
                Fechar
              </Button>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const order: Step[] = ["describe", "reproduce", "context"];
  const idx = order.indexOf(step);
  if (idx < 0) return null;
  return (
    <div className="flex items-center gap-1 shrink-0" aria-label={`Etapa ${idx + 1} de 3`}>
      {order.map((s, i) => (
        <span
          key={s}
          className={cn(
            "h-1.5 rounded-full transition-all",
            i === idx ? "w-5 bg-primary" : i < idx ? "w-2 bg-primary/40" : "w-2 bg-muted",
          )}
        />
      ))}
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className="space-y-4"
    >
      {children}
    </motion.div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-body font-medium text-foreground/80">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ContextPreview({
  collectContext,
  severity,
}: {
  collectContext: () => ReturnType<ReturnType<typeof useDeviceContext>>;
  severity: Severity;
}) {
  // Snapshot único — não recalcular no scroll para manter integridade
  const ctx = useMemo(() => collectContext(), [collectContext]);
  const DeviceIcon = ctx.deviceType === "mobile" ? Smartphone : ctx.deviceType === "tablet" ? Tablet : Monitor;
  const errorCount = ctx.consoleErrors.filter((e) => e.level === "error").length;
  const filterKeys = Object.keys(ctx.activeFilters).filter((k) => k !== "__route_hint");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className="space-y-3"
    >
      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] uppercase tracking-wider font-display font-semibold text-muted-foreground">
            Contexto técnico
          </span>
          <Badge variant="secondary" className={cn("text-[10px]", SEVERITY_COLOR[severity])}>
            {SEVERITY_LABEL[severity]}
          </Badge>
        </div>

        <ContextRow icon={<DeviceIcon className="h-3.5 w-3.5" />} label="Dispositivo">
          {ctx.deviceType} · {ctx.viewportWidth}×{ctx.viewportHeight} @{ctx.devicePixelRatio}x
        </ContextRow>
        <ContextRow label="Sistema">{ctx.osName} · {ctx.browserName} {ctx.browserVersion}</ContextRow>
        <ContextRow label="Rota">{ctx.route}</ContextRow>
        {ctx.userRole && <ContextRow label="Papel">{ctx.userRole}</ContextRow>}
      </div>

      {filterKeys.length > 0 && (
        <div className="rounded-lg border border-border p-3 space-y-1.5">
          <span className="text-[11px] uppercase tracking-wider font-display font-semibold text-muted-foreground">
            Filtros ativos ({filterKeys.length})
          </span>
          <div className="flex flex-wrap gap-1">
            {filterKeys.slice(0, 8).map((k) => (
              <span key={k} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {k}
              </span>
            ))}
            {filterKeys.length > 8 && (
              <span className="text-[10px] text-muted-foreground">+{filterKeys.length - 8}</span>
            )}
          </div>
        </div>
      )}

      <div
        className={cn(
          "rounded-lg border p-3 space-y-1.5",
          errorCount > 0 ? "border-destructive/30 bg-destructive/5" : "border-border",
        )}
      >
        <div className="flex items-center gap-1.5">
          {errorCount > 0 && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
          <span className="text-[11px] uppercase tracking-wider font-display font-semibold text-muted-foreground">
            Erros recentes ({ctx.consoleErrors.length})
          </span>
        </div>
        {ctx.consoleErrors.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum erro capturado nesta sessão.</p>
        ) : (
          <ul className="space-y-1 max-h-32 overflow-y-auto">
            {ctx.consoleErrors.slice(-5).reverse().map((e, i) => (
              <li key={i} className="text-[10.5px] font-mono leading-tight">
                <span
                  className={cn(
                    "inline-block px-1 rounded mr-1 text-[9px] font-bold uppercase",
                    e.level === "error" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning",
                  )}
                >
                  {e.level}
                </span>
                <span className="text-foreground/80">{e.message.slice(0, 140)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground italic">
        Ao enviar, esses dados serão salvos junto do report para acelerar o diagnóstico. Nenhuma informação sensível
        (senhas, tokens) é coletada.
      </p>
    </motion.div>
  );
}

function ContextRow({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-muted-foreground min-w-[80px] flex items-center gap-1">
        {icon}
        {label}
      </span>
      <span className="text-foreground/90 font-mono text-[11px] break-all">{children}</span>
    </div>
  );
}
