import { useState, useEffect } from "react";
import { History, Copy, CheckCircle, Upload, FileText, FileSpreadsheet, Loader2, ChevronDown, ChevronUp, GitCompare, Clock, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/formatBRL";
import { getVersionHistory, duplicateBudgetAsVersion, setCurrentVersion, deleteDraftVersion } from "@/lib/budget-versioning";
import { getVersionAuditEvents } from "@/lib/version-audit";
import type { VersionRow, BudgetEventRow } from "@/types/budget-common";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { ImportExcelModal } from "@/components/budget/ImportExcelModal";
import { assignImportedBudgetToGroup } from "@/lib/budget-versioning";

const VERSION_CHANGE_REASONS = [
  { value: "cliente", label: "Mudança do cliente" },
  { value: "escopo", label: "Ajuste de escopo" },
  { value: "preco", label: "Revisão de preço" },
  { value: "comercial", label: "Ajuste comercial" },
  { value: "tecnica", label: "Revisão técnica" },
  { value: "outro", label: "Outro" },
] as const;

interface VersionHistoryPanelProps {
  budgetId: string;
  onVersionChange?: () => void;
  defaultExpanded?: boolean;
}

export function VersionHistoryPanel({ budgetId, onVersionChange, defaultExpanded = false }: VersionHistoryPanelProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [auditEvents, setAuditEvents] = useState<BudgetEventRow[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [importOpen, setImportOpen] = useState(false);
  const [importType, setImportType] = useState<"pdf" | "excel">("pdf");
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);

  const toggleCompareSelection = (versionId: string) => {
    setCompareSelection((prev) => {
      if (prev.includes(versionId)) return prev.filter((id) => id !== versionId);
      if (prev.length >= 2) return [prev[1], versionId]; // FIFO: mantém só as duas últimas
      return [...prev, versionId];
    });
  };

  const exitCompareMode = () => {
    setCompareMode(false);
    setCompareSelection([]);
  };

  const handleCompareSelected = () => {
    if (compareSelection.length !== 2) return;
    // Ordena por version_number (asc) para "left = anterior, right = nova"
    const ordered = [...compareSelection].sort((a, b) => {
      const va = versions.find((v) => v.id === a)?.version_number ?? 0;
      const vb = versions.find((v) => v.id === b)?.version_number ?? 0;
      return va - vb;
    });
    navigate(`/admin/comparar?left=${ordered[0]}&right=${ordered[1]}`);
  };

  const loadVersions = async () => {
    setLoading(true);
    try {
      const result = await getVersionHistory(budgetId);
      setVersions(result.versions);
      setGroupId(result.groupId);
      // Fetch audit events for all versions in the group
      const allIds = result.versions.map((v: VersionRow) => v.id);
      const events = await getVersionAuditEvents(allIds);
      setAuditEvents(events);
    } catch (err) {
      console.error("Failed to load versions:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgetId]);

  const [changeReasonInput, setChangeReasonInput] = useState("");
  const [changeCategory, setChangeCategory] = useState("");
  const [showReasonDialog, setShowReasonDialog] = useState<string | null>(null);

  const handleDuplicate = async (sourceId: string) => {
    if (!user) return;
    setDuplicating(true);
    try {
      const categoryLabel = VERSION_CHANGE_REASONS.find((r) => r.value === changeCategory)?.label || "";
      const fullReason = [categoryLabel, changeReasonInput].filter(Boolean).join(": ");
      const newId = await duplicateBudgetAsVersion(sourceId, user.id, fullReason || undefined);
      setChangeReasonInput("");
      setChangeCategory("");
      setShowReasonDialog(null);
      toast.success("Nova versão criada com sucesso!");
      navigate(`/admin/budget/${newId}`);
    } catch (err: unknown) {
      toast.error((err instanceof Error ? err.message : null) || "Erro ao duplicar versão");
    }
    setDuplicating(false);
  };

  const promptDuplicate = (sourceId: string) => {
    setShowReasonDialog(sourceId);
  };

  const handleSetCurrent = async (versionId: string) => {
    if (!groupId || !user) return;
    try {
      await setCurrentVersion(versionId, groupId, user.id);
      toast.success("Versão ativada como atual");
      await loadVersions();
      onVersionChange?.();
    } catch (err: unknown) {
      toast.error("Erro ao alterar versão");
    }
  };

  const [deleteTarget, setDeleteTarget] = useState<VersionRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteVersion = async () => {
    if (!deleteTarget || !user) return;
    setDeleting(true);
    try {
      await deleteDraftVersion(deleteTarget.id, user.id);
      toast.success(`V${deleteTarget.version_number} excluída`);
      setDeleteTarget(null);
      await loadVersions();
      onVersionChange?.();
    } catch (err: unknown) {
      toast.error((err instanceof Error ? err.message : null) || "Erro ao excluir versão");
    }
    setDeleting(false);
  };

  const handleImportClose = async (open: boolean) => {
    setImportOpen(open);
    if (!open) {
      // Check if a new budget was created (the modal navigates, so we reload)
      await loadVersions();
    }
  };

  const currentVersion = versions.find((v) => v.id === budgetId);
  const otherVersions = versions.filter((v) => v.id !== budgetId);

  const statusLabels: Record<string, string> = {
    draft: "Rascunho",
    published: "Publicado",
    approved: "Aprovado",
    archived: "Arquivado",
    superseded: "Substituída",
    in_progress: "Em produção",
    ready: "Pronta",
  };

  const statusColors: Record<string, string> = {
    draft: "text-muted-foreground",
    published: "text-success",
    approved: "text-primary",
    archived: "text-muted-foreground",
    superseded: "text-muted-foreground",
    in_progress: "text-warning",
    ready: "text-green-600",
  };

  return (
    <>
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <span className="font-display font-semibold text-sm text-foreground">
              Histórico de Versões
            </span>
            {versions.length > 1 && (
              <span className="text-xs text-muted-foreground font-body">
                ({versions.length} versões)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {currentVersion && (
              <span className="text-xs font-body text-primary font-medium">
                V{currentVersion.version_number}
              </span>
            )}
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {expanded && (
          <div className="border-t border-border">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Compare-mode toolbar */}
                {versions.length >= 2 && (
                  <div className="px-4 py-2.5 border-b border-border bg-muted/20 flex items-center justify-between gap-2 flex-wrap">
                    {!compareMode ? (
                      <>
                        <p className="text-xs text-muted-foreground font-body">
                          Compare duas versões para ver o que mudou.
                        </p>
                        <button
                          onClick={() => { setCompareMode(true); setCompareSelection([]); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-body font-medium border border-border bg-card hover:bg-muted text-foreground transition-colors"
                        >
                          <GitCompare className="h-3 w-3" />
                          Comparar versões
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-body text-foreground">
                          {compareSelection.length === 0 && "Selecione 2 versões para comparar."}
                          {compareSelection.length === 1 && "Selecione mais 1 versão."}
                          {compareSelection.length === 2 && (
                            <>
                              Pronto:{" "}
                              <span className="font-semibold">
                                {compareSelection
                                  .map((id) => `V${versions.find((v) => v.id === id)?.version_number ?? "?"}`)
                                  .join(" ↔ ")}
                              </span>
                            </>
                          )}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={exitCompareMode}
                            className="px-3 py-1.5 rounded-md text-xs font-body text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={handleCompareSelected}
                            disabled={compareSelection.length !== 2}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-body font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <GitCompare className="h-3 w-3" />
                            Comparar selecionadas
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Current version highlight */}
                {currentVersion && (
                  <div className="px-4 py-3 bg-primary/5 border-b border-border">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {compareMode && (
                          <input
                            type="checkbox"
                            checked={compareSelection.includes(currentVersion.id)}
                            onChange={() => toggleCompareSelection(currentVersion.id)}
                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer shrink-0"
                            aria-label={`Selecionar V${currentVersion.version_number} para comparação`}
                          />
                        )}
                        <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-display font-bold text-sm text-foreground">
                            V{currentVersion.version_number}
                          </span>
                          <span className="text-xs text-primary font-body font-medium">
                            Atual
                          </span>
                          {currentVersion.is_published_version && (
                            <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded-full font-body font-medium">
                              Publicada
                            </span>
                          )}
                          <span className={`text-xs font-body ${statusColors[currentVersion.status]}`}>
                            · {statusLabels[currentVersion.status] || currentVersion.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground font-body mt-0.5">
                          {currentVersion.created_at ? formatDate(currentVersion.created_at) : "—"}
                          {currentVersion.created_by_name && currentVersion.created_by_name !== "—" && (
                            <span className="ml-1">· por {currentVersion.created_by_name}</span>
                          )}
                          {currentVersion.change_reason && <span className="ml-1 italic">— {currentVersion.change_reason}</span>}
                        </p>
                        </div>
                      </div>
                      <button
                        onClick={() => promptDuplicate(currentVersion.id)}
                        disabled={duplicating}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-body font-medium bg-muted hover:bg-muted/80 text-foreground transition-colors disabled:opacity-50"
                      >
                        {duplicating && showReasonDialog === currentVersion.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                        Nova versão formal
                      </button>
                    </div>
                  </div>
                )}

                {/* Other versions */}
                {otherVersions.length > 0 && (
                  <div className="divide-y divide-border">
                    {otherVersions.map((v) => (
                      <div key={v.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {compareMode && (
                            <input
                              type="checkbox"
                              checked={compareSelection.includes(v.id)}
                              onChange={() => toggleCompareSelection(v.id)}
                              className="h-4 w-4 rounded border-border accent-primary cursor-pointer shrink-0"
                              aria-label={`Selecionar V${v.version_number} para comparação`}
                            />
                          )}
                          <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-display font-medium text-sm text-foreground">
                              V{v.version_number}
                            </span>
                            {v.is_current_version && (
                              <span className="text-xs text-primary font-body font-medium">
                                Atual
                              </span>
                            )}
                            {v.is_published_version && (
                              <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded-full font-body font-medium">
                                Publicada
                              </span>
                            )}
                            <span className={`text-xs font-body ${statusColors[v.status]}`}>
                              · {statusLabels[v.status] || v.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground font-body">
                            {v.created_at ? formatDate(v.created_at) : "—"}
                            {v.created_by_name && v.created_by_name !== "—" && (
                              <span className="ml-1">· por {v.created_by_name}</span>
                            )}
                            {v.change_reason && <span className="ml-1 italic">— {v.change_reason}</span>}
                          </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {!v.is_current_version && (
                            <button
                              onClick={() => handleSetCurrent(v.id)}
                              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-body text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              title="Definir como versão atual"
                            >
                              <CheckCircle className="h-3 w-3" /> Ativar
                            </button>
                          )}
                          <button
                            onClick={() => handleDuplicate(v.id)}
                            disabled={duplicating}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-body text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                            title="Duplicar para nova versão"
                          >
                            <Copy className="h-3 w-3" /> Duplicar
                          </button>
                          <button
                            onClick={() => navigate(`/admin/comparar?left=${v.id}&right=${budgetId}`)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-body text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="Comparar com versão atual"
                          >
                            <GitCompare className="h-3 w-3" /> Comparar
                          </button>
                          <button
                            onClick={() => navigate(`/admin/budget/${v.id}`)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-body text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="Abrir esta versão"
                          >
                            Abrir
                          </button>
                          {v.status === "draft" && !v.is_current_version && !v.is_published_version && (
                            <button
                              onClick={() => setDeleteTarget(v)}
                              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-body text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title="Excluir rascunho"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Audit Trail */}
                <div className="border-t border-border">
                  <button
                    onClick={() => setShowAudit(!showAudit)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-body text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <Clock className="h-3 w-3" />
                    Trilha de auditoria
                    {auditEvents.length > 0 && (
                      <span className="text-[10px] bg-muted rounded-full px-1.5">{auditEvents.length}</span>
                    )}
                    {showAudit ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
                  </button>
                  {showAudit && (
                    <div className="px-4 pb-3 space-y-0">
                      {auditEvents.length === 0 ? (
                        <p className="text-xs text-muted-foreground font-body py-2">Nenhum evento registrado.</p>
                      ) : (
                        <div className="relative ml-2 border-l border-border">
                          {auditEvents.map((evt) => (
                            <div key={evt.id} className="pl-4 py-1.5 relative">
                              <div className="absolute -left-[5px] top-[10px] w-2 h-2 rounded-full bg-muted-foreground/40" />
                              <p className="text-xs font-body text-foreground leading-snug">{evt.note}</p>
                              <p className="text-[10px] text-muted-foreground font-body">
                                {evt.created_at ? formatDate(evt.created_at) : "—"}
                                {evt.user_name && evt.user_name !== "—" && evt.user_name !== "Sistema" && (
                                  <span className="ml-1">· {evt.user_name}</span>
                                )}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Import as new version */}
                <div className="px-4 py-3 border-t border-border bg-muted/30">
                  <p className="text-xs text-muted-foreground font-body mb-2">
                    Importar arquivo como nova versão deste orçamento:
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setImportType("pdf"); setImportOpen(true); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-body font-medium border border-border bg-card hover:bg-muted transition-colors text-foreground"
                    >
                      <FileText className="h-3 w-3 text-muted-foreground" /> PDF
                    </button>
                    <button
                      onClick={() => { setImportType("excel"); setImportOpen(true); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-body font-medium border border-border bg-card hover:bg-muted transition-colors text-foreground"
                    >
                      <FileSpreadsheet className="h-3 w-3 text-muted-foreground" /> Planilha
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Change reason dialog */}
      {showReasonDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setShowReasonDialog(null); setChangeReasonInput(""); setChangeCategory(""); }}>
          <div className="bg-card border border-border rounded-xl shadow-lg p-5 w-full max-w-md mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-foreground">Nova versão formal</h3>
            <p className="text-sm text-muted-foreground font-body">
              A versão anterior será preservada. Selecione o motivo:
            </p>

            {/* Category chips */}
            <div className="flex flex-wrap gap-1.5">
              {VERSION_CHANGE_REASONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setChangeCategory(r.value)}
                  className={`px-2.5 py-1 rounded-full text-xs font-body transition-colors border ${
                    changeCategory === r.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Free-text detail */}
            <input
              type="text"
              value={changeReasonInput}
              onChange={(e) => setChangeReasonInput(e.target.value)}
              placeholder="Detalhe opcional (ex: Cliente pediu revisão da marcenaria)"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-body placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              onKeyDown={(e) => { if (e.key === "Enter") handleDuplicate(showReasonDialog); }}
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowReasonDialog(null); setChangeReasonInput(""); setChangeCategory(""); }}
                className="px-3 py-1.5 rounded-md text-sm font-body text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDuplicate(showReasonDialog)}
                disabled={duplicating || !changeCategory}
                className="px-4 py-1.5 rounded-md text-sm font-body font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {duplicating ? "Criando..." : "Criar versão"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete draft confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="bg-card border border-border rounded-xl shadow-lg p-5 w-full max-w-md mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-foreground">Excluir rascunho V{deleteTarget.version_number}?</h3>
            <p className="text-sm text-muted-foreground font-body">
              Esta ação é permanente e removerá todas as seções, itens e ajustes desta versão. As demais versões do orçamento serão preservadas.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-3 py-1.5 rounded-md text-sm font-body text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteVersion}
                disabled={deleting}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-body font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                {deleting ? "Excluindo..." : "Excluir rascunho"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ImportExcelModal
        open={importOpen}
        onOpenChange={handleImportClose}
        fileFilter={importType}
        targetBudgetGroupId={groupId || budgetId}
      />
    </>
  );
}
