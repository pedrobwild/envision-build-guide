import { useMemo, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Check, X, RotateCcw, Save, FileText, Link2, Copy, ExternalLink, Download, FileSpreadsheet, FileDown, ChevronDown, MoreHorizontal, Send, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { INTERNAL_STATUSES, type InternalStatus } from "@/lib/role-constants";
import { formatBRL } from "@/lib/formatBRL";
import { calcGrandTotals, type CalcSection } from "@/lib/budget-calc";
import { cn } from "@/lib/utils";
import { getPublicBudgetUrl } from "@/lib/getPublicUrl";
import { openPublicBudgetByPublicId } from "@/lib/openPublicBudget";
import { ExportPreviewDialog } from "@/components/budget/ExportPreviewDialog";
import { toast } from "sonner";
import type { BudgetRow } from "@/types/budget-common";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface StickyEditorHeaderProps {
  budget: BudgetRow;
  sections: CalcSection[];
  backPath: string;
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  onRetrySave?: () => void;
  onPublish?: () => void;
  publishing?: boolean;
  onProjectNameChange?: (name: string) => void;
  primaryAction?: {
    label: string;
    onClick: () => void;
    variant?: string;
    icon?: React.ReactNode;
    className?: string;
  } | null;
}

function getPdfUrl(budget: BudgetRow): string | null {
  const path = (budget as Record<string, unknown>).budget_pdf_url;
  if (!path || typeof path !== "string") return null;
  return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/budget-pdfs/${path}`;
}

function getStatusBadgeClass(status: InternalStatus): string {
  switch (status) {
    case "in_progress":
      return "bg-primary/10 text-primary border-primary/20";
    case "ready_for_review":
      return "bg-warning/10 text-warning border-warning/20";
    case "delivered_to_sales":
      return "bg-accent text-accent-foreground border-border";
    case "sent_to_client":
      return "bg-success/10 text-success border-success/20";
    case "revision_requested":
      return "bg-warning/10 text-warning border-warning/20";
    case "minuta_solicitada":
      return "bg-accent text-accent-foreground border-border";
    case "contrato_fechado":
      return "bg-success/10 text-success border-success/20";
    case "waiting_info":
      return "bg-destructive/10 text-destructive border-destructive/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function AutoSaveChip({ status, lastSavedAt, onRetry }: { status: SaveStatus; lastSavedAt: Date | null; onRetry?: () => void }) {
  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground font-body px-2.5 py-1 rounded-full bg-muted/60">
        <Loader2 className="h-3 w-3 animate-spin" />
        Salvando…
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-destructive font-body px-2.5 py-1 rounded-full bg-destructive/10">
        <X className="h-3 w-3" />
        Erro
        {onRetry && (
          <button onClick={onRetry} className="underline hover:no-underline ml-0.5">
            Tentar novamente
          </button>
        )}
      </span>
    );
  }

  if (status === "saved" && lastSavedAt) {
    const seconds = Math.max(0, Math.round((Date.now() - lastSavedAt.getTime()) / 1000));
    const label = seconds < 5 ? "agora" : `há ${seconds}s`;
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-success font-body px-2.5 py-1 rounded-full bg-success/10">
        <Check className="h-3 w-3" />
        Salvo {label}
      </span>
    );
  }

  return null;
}

export function StickyEditorHeader({
  budget,
  sections,
  backPath,
  saveStatus,
  lastSavedAt,
  onRetrySave,
  onPublish,
  publishing,
  onProjectNameChange,
  primaryAction,
}: StickyEditorHeaderProps) {
  const navigate = useNavigate();
  const internalStatus = (budget.internal_status ?? "requested") as InternalStatus;
  const statusInfo = INTERNAL_STATUSES[internalStatus] ?? INTERNAL_STATUSES.requested;

  const totals = useMemo(() => calcGrandTotals(sections), [sections]);
  const pdfUrl = getPdfUrl(budget);
  const manualTotal = (budget as Record<string, unknown>).manual_total as number | null;
  const isPdfOnly = !!pdfUrl && sections.length === 0 && totals.sale === 0;

  const projectName = budget.project_name || "Sem nome";
  const truncatedName = projectName.length > 30 ? projectName.slice(0, 30) + "…" : projectName;

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(projectName);
  const nameInputRef = useRef<HTMLInputElement>(null);
  // Pré-visualização do export antes do download. O estado é único; o
  // botão correspondente mostra spinner enquanto o diálogo está aberto
  // (gerando ou exibindo o preview).
  const [previewExport, setPreviewExport] = useState<
    { budgetId: string; kind: "pdf" | "xlsx" } | null
  >(null);
  const exporting: "xlsx" | "pdf" | null = previewExport?.kind ?? null;

  const handleExport = (kind: "xlsx" | "pdf") => {
    if (!budget.id || exporting) return;
    setPreviewExport({ budgetId: budget.id, kind });
  };

  useEffect(() => {
    setNameValue(budget.project_name || "");
  }, [budget.project_name]);

  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  const commitName = () => {
    setEditingName(false);
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== budget.project_name && onProjectNameChange) {
      onProjectNameChange(trimmed);
    } else {
      setNameValue(budget.project_name || "");
    }
  };

  const marginColor = totals.marginPercent >= 15
    ? "text-success"
    : totals.marginPercent >= 10
    ? "text-warning"
    : "text-destructive";

  return (
    <>
    <div className="sticky top-0 z-50 bg-card/85 backdrop-blur-xl border-b border-border/40 shadow-sm">
      {/* Layer 1 — Breadcrumb + status + action + auto-save */}
      <div className="max-w-[1200px] mx-auto px-3 sm:px-6 h-12 sm:h-14 flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <button
            onClick={() => navigate(backPath)}
            className="p-1.5 sm:p-2 rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground transition-all duration-200 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          {editingName ? (
            <input
              ref={nameInputRef}
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName();
                if (e.key === "Escape") {
                  setNameValue(budget.project_name || "");
                  setEditingName(false);
                }
              }}
              className="text-foreground font-semibold font-display text-sm tracking-tight min-w-0 flex-1 bg-transparent border-none outline-none ring-1 ring-primary/30 rounded px-1.5 py-0.5"
              placeholder="Nome do projeto"
            />
          ) : (
            <span
              onClick={() => onProjectNameChange && setEditingName(true)}
              className={cn(
                "text-foreground font-semibold font-display truncate text-sm tracking-tight min-w-0",
                onProjectNameChange && "cursor-text hover:bg-muted/30 rounded px-1 -mx-1 transition-colors"
              )}
            >
              {truncatedName}
            </span>
          )}

          <Badge className={cn("text-[10px] font-body border shrink-0 rounded-full px-2", getStatusBadgeClass(internalStatus))}>
            {statusInfo.icon} <span className="hidden sm:inline ml-1">{statusInfo.label}</span>
          </Badge>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/*
            Em mobile, Link público + PDF + Export ficam consolidados em um único
            menu overflow ("Mais") para liberar espaço ao CTA principal de salvar/publicar.
            Em ≥sm cada item volta a aparecer como chip independente.
          */}
          {budget.public_id && (
            <div className="hidden sm:inline-flex items-center rounded-full bg-success/10 hover:bg-success/15 transition-colors shrink-0 overflow-hidden">
              <button
                type="button"
                onClick={() => void openPublicBudgetByPublicId(budget.public_id!)}
                className="inline-flex items-center gap-1.5 text-[11px] font-body font-medium text-success hover:text-success/80 pl-2.5 pr-1.5 py-1"
                title="Abrir orçamento público em nova aba"
              >
                <Link2 className="h-3.5 w-3.5" />
                <span>Link público</span>
                <ExternalLink className="h-3 w-3 opacity-70" />
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(getPublicBudgetUrl(budget.public_id!));
                    toast.success("Link público copiado");
                  } catch {
                    toast.error("Não foi possível copiar o link");
                  }
                }}
                className="inline-flex items-center justify-center px-1.5 py-1 border-l border-success/20 text-success hover:text-success/80"
                title="Copiar link público"
                aria-label="Copiar link público"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          )}
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-body font-medium text-primary hover:text-primary/80 px-2.5 py-1 rounded-full bg-primary/10 hover:bg-primary/15 transition-colors shrink-0"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Ver PDF original</span>
            </a>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={!budget.id || !!exporting}
                className="hidden sm:inline-flex items-center gap-1 text-[11px] font-body font-medium text-foreground/80 hover:text-foreground px-2.5 py-1 rounded-full bg-muted/60 hover:bg-muted transition-colors shrink-0 disabled:opacity-50"
                title="Exportar versão atual"
              >
                {exporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                <span>Exportar</span>
                <ChevronDown className="h-3 w-3 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-[11px] font-body font-medium text-muted-foreground">
                Versão atual
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleExport("xlsx")}
                disabled={!!exporting}
                className="gap-2 cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4 text-success" />
                <span className="flex-1">Exportar .xlsx</span>
                {exporting === "xlsx" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleExport("pdf")}
                disabled={!!exporting}
                className="gap-2 cursor-pointer"
              >
                <FileDown className="h-4 w-4 text-destructive" />
                <span className="flex-1">Exportar .pdf</span>
                {exporting === "pdf" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Overflow menu mobile-only: agrupa Link, PDF, Exportar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Mais ações"
                className="sm:hidden h-9 w-9 rounded-full"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {budget.public_id && (
                <>
                  <DropdownMenuItem
                    onClick={() => void openPublicBudgetByPublicId(budget.public_id!)}
                    className="gap-2 cursor-pointer"
                  >
                    <Link2 className="h-4 w-4 text-success" />
                    <span className="flex-1">Abrir link público</span>
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(getPublicBudgetUrl(budget.public_id!));
                        toast.success("Link público copiado");
                      } catch {
                        toast.error("Não foi possível copiar o link");
                      }
                    }}
                    className="gap-2 cursor-pointer"
                  >
                    <Copy className="h-4 w-4" />
                    Copiar link
                  </DropdownMenuItem>
                </>
              )}
              {pdfUrl && (
                <DropdownMenuItem asChild className="gap-2 cursor-pointer">
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                    <FileText className="h-4 w-4 text-primary" />
                    Ver PDF original
                  </a>
                </DropdownMenuItem>
              )}
              {(budget.public_id || pdfUrl) && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="text-[11px] font-body font-medium text-muted-foreground">
                Exportar versão atual
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => handleExport("xlsx")}
                disabled={!!exporting}
                className="gap-2 cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4 text-success" />
                <span className="flex-1">Exportar .xlsx</span>
                {exporting === "xlsx" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleExport("pdf")}
                disabled={!!exporting}
                className="gap-2 cursor-pointer"
              >
                <FileDown className="h-4 w-4 text-destructive" />
                <span className="flex-1">Exportar .pdf</span>
                {exporting === "pdf" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="hidden sm:block">
            <AutoSaveChip status={saveStatus} lastSavedAt={lastSavedAt} onRetry={onRetrySave} />
          </div>

          {onPublish && (
            <Button
              size="sm"
              className="h-9 sm:h-8 px-3 text-xs gap-1.5 shrink-0"
              onClick={onPublish}
              disabled={publishing}
              aria-label={publishing ? "Publicando" : "Salvar e Publicar"}
            >
              {publishing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{publishing ? "Publicando…" : "Salvar e Publicar"}</span>
              <span className="sm:hidden">{publishing ? "…" : "Publicar"}</span>
            </Button>
          )}

          {primaryAction && (
            <Button
              size="sm"
              className={cn("h-9 sm:h-8 px-3 text-xs gap-1.5 shrink-0", primaryAction.className)}
              onClick={primaryAction.onClick}
              aria-label={primaryAction.label}
            >
              {primaryAction.icon}
              <span className="hidden sm:inline">{primaryAction.label}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Layer 2 — Financial totals or PDF-only mode */}
      <div className="border-t border-border/20">
        <div className="max-w-[1200px] mx-auto px-3 sm:px-6 py-1.5 sm:py-0 sm:h-10 flex items-center">
          {isPdfOnly && manualTotal ? (
            <div className="flex items-center gap-3 text-xs font-body">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground uppercase tracking-widest text-[9px] sm:text-[10px] font-medium">Valor do orçamento (PDF externo)</span>
                <span className="font-bold tabular-nums text-success tracking-tight text-[11px] sm:text-xs">
                  {formatBRL(manualTotal)}
                </span>
              </div>
              <span className="text-[9px] text-muted-foreground/60 bg-muted/60 px-2 py-0.5 rounded-full">Valor informado manualmente</span>
            </div>
          ) : (
            <div className="flex sm:flex sm:gap-6 w-full text-xs font-body items-center justify-between sm:justify-start">
              {/* Mobile: priorizamos só Venda + Margem%; demais ficam só em ≥sm */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                <span className="text-muted-foreground uppercase tracking-widest text-[9px] sm:text-[10px] font-medium">Venda</span>
                <span className="font-bold tabular-nums text-success tracking-tight text-[11px] sm:text-xs">
                  {formatBRL(totals.sale)}
                </span>
              </div>

              <div className="hidden sm:flex flex-col sm:flex-row sm:items-center sm:gap-2">
                <span className="text-muted-foreground uppercase tracking-widest text-[9px] sm:text-[10px] font-medium">Custo</span>
                <span className="font-semibold tabular-nums text-muted-foreground tracking-tight text-[11px] sm:text-xs">
                  {formatBRL(totals.cost)}
                </span>
              </div>

              <div className="hidden sm:flex flex-col sm:flex-row sm:items-center sm:gap-2">
                <span className="text-muted-foreground uppercase tracking-widest text-[9px] sm:text-[10px] font-medium">BDI</span>
                <span className="font-semibold tabular-nums text-primary tracking-tight text-[11px] sm:text-xs">
                  {totals.bdiPercent.toFixed(1)}%
                </span>
              </div>

              <div className="hidden sm:flex flex-col sm:flex-row sm:items-center sm:gap-2">
                <span className="text-muted-foreground uppercase tracking-widest text-[9px] sm:text-[10px] font-medium">Margem R$</span>
                <span className={cn("font-bold tabular-nums tracking-tight text-[11px] sm:text-xs", marginColor)}>
                  {formatBRL(totals.margin)}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 items-end sm:items-center">
                <span className="text-muted-foreground uppercase tracking-widest text-[9px] sm:text-[10px] font-medium">Margem</span>
                <span className={cn("font-bold tabular-nums tracking-tight text-[11px] sm:text-xs", marginColor)}>
                  {totals.marginPercent.toFixed(1)}%
                </span>
              </div>

              {/* Mini chip de autosave em mobile, ao lado dos números */}
              <div className="sm:hidden ml-auto">
                <AutoSaveChip status={saveStatus} lastSavedAt={lastSavedAt} onRetry={onRetrySave} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    <ExportPreviewDialog
      open={!!previewExport}
      onOpenChange={(open) => {
        if (!open) setPreviewExport(null);
      }}
      budgetId={previewExport?.budgetId ?? null}
      kind={previewExport?.kind ?? "pdf"}
    />
    </>
  );
}
