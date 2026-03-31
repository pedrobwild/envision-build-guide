import { useState, useEffect } from "react";
import { History, Copy, CheckCircle, Upload, FileText, FileSpreadsheet, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { formatDate } from "@/lib/formatBRL";
import { getVersionHistory, duplicateBudgetAsVersion, setCurrentVersion } from "@/lib/budget-versioning";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { ImportExcelModal } from "@/components/budget/ImportExcelModal";
import { assignImportedBudgetToGroup } from "@/lib/budget-versioning";

interface VersionHistoryPanelProps {
  budgetId: string;
  onVersionChange?: () => void;
}

export function VersionHistoryPanel({ budgetId, onVersionChange }: VersionHistoryPanelProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [versions, setVersions] = useState<any[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importType, setImportType] = useState<"pdf" | "excel">("pdf");

  const loadVersions = async () => {
    setLoading(true);
    try {
      const result = await getVersionHistory(budgetId);
      setVersions(result.versions);
      setGroupId(result.groupId);
    } catch (err) {
      console.error("Failed to load versions:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadVersions();
  }, [budgetId]);

  const [changeReasonInput, setChangeReasonInput] = useState("");
  const [showReasonDialog, setShowReasonDialog] = useState<string | null>(null);

  const handleDuplicate = async (sourceId: string) => {
    if (!user) return;
    setDuplicating(true);
    try {
      const newId = await duplicateBudgetAsVersion(sourceId, user.id, changeReasonInput || undefined);
      setChangeReasonInput("");
      setShowReasonDialog(null);
      toast.success("Nova versão criada com sucesso!");
      navigate(`/admin/budget/${newId}`);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao duplicar versão");
    }
    setDuplicating(false);
  };

  const promptDuplicate = (sourceId: string) => {
    setShowReasonDialog(sourceId);
  };

  const handleSetCurrent = async (versionId: string) => {
    if (!groupId) return;
    try {
      await setCurrentVersion(versionId, groupId);
      toast.success("Versão ativada como atual");
      await loadVersions();
      onVersionChange?.();
    } catch (err: any) {
      toast.error("Erro ao alterar versão");
    }
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
  };

  const statusColors: Record<string, string> = {
    draft: "text-muted-foreground",
    published: "text-success",
    approved: "text-primary",
    archived: "text-muted-foreground",
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
                {/* Current version highlight */}
                {currentVersion && (
                  <div className="px-4 py-3 bg-primary/5 border-b border-border">
                    <div className="flex items-center justify-between">
                      <div>
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
                        </p>
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
                      <div key={v.id} className="px-4 py-2.5 flex items-center justify-between">
                        <div>
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
                            {v.change_reason && <span className="ml-1 italic">— {v.change_reason}</span>}
                          </p>
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
                            onClick={() => navigate(`/admin/budget/${v.id}`)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-body text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="Abrir esta versão"
                          >
                            Abrir
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-xl shadow-lg p-5 w-full max-w-md mx-4 space-y-4">
            <h3 className="font-display font-bold text-foreground">Nova versão formal</h3>
            <p className="text-sm text-muted-foreground font-body">
              Descreva brevemente o motivo da nova versão (opcional):
            </p>
            <input
              type="text"
              value={changeReasonInput}
              onChange={(e) => setChangeReasonInput(e.target.value)}
              placeholder="Ex: Cliente pediu revisão do escopo de marcenaria"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-body placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleDuplicate(showReasonDialog); }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowReasonDialog(null); setChangeReasonInput(""); }}
                className="px-3 py-1.5 rounded-md text-sm font-body text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDuplicate(showReasonDialog)}
                disabled={duplicating}
                className="px-4 py-1.5 rounded-md text-sm font-body font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {duplicating ? "Criando..." : "Criar versão"}
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
