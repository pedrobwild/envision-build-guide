import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/formatBRL";
import { getVersionHistory, duplicateBudgetAsVersion } from "@/lib/budget-versioning";
import { getVersionAuditEvents } from "@/lib/version-audit";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Loader2, Plus, GitCompare, ExternalLink, Clock, Copy,
  FileText, FileSpreadsheet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { ImportExcelModal } from "@/components/budget/ImportExcelModal";

interface VersionTimelineProps {
  budgetId: string;
  onVersionChange?: () => void;
}

export function VersionTimeline({ budgetId, onVersionChange }: VersionTimelineProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [versions, setVersions] = useState<Record<string, unknown>[]>([]);
  const [auditEvents, setAuditEvents] = useState<Record<string, unknown>[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revisionReasons, setRevisionReasons] = useState<Record<string, string>>({});

  // New version dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newVersionReason, setNewVersionReason] = useState("");
  const [creating, setCreating] = useState(false);

  // Import
  const [importOpen, setImportOpen] = useState(false);
  const [importType, setImportType] = useState<"pdf" | "excel">("pdf");

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await getVersionHistory(budgetId);
      setVersions(result.versions);
      setGroupId(result.groupId);

      // Load audit events
      const allIds = result.versions.map((v: Record<string, unknown>) => v.id as string);
      const events = await getVersionAuditEvents(allIds);
      setAuditEvents(events);

      // Load revision reasons for each version
      const reasons: Record<string, string> = {};
      for (const v of result.versions) {
        const { data: evt } = await supabase
          .from("budget_events")
          .select("metadata")
          .eq("budget_id", v.id)
          .eq("event_type", "revision_requested")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (evt?.metadata) {
          const meta = evt.metadata as Record<string, unknown>;
          if (meta.instructions) reasons[v.id] = String(meta.instructions);
          else if (meta.reason) reasons[v.id] = String(meta.reason);
        }
      }
      setRevisionReasons(reasons);
    } catch (err) {
      console.error("Failed to load version timeline:", err);
    }
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, [budgetId]);

  const handleCreateVersion = async () => {
    if (!user || newVersionReason.trim().length < 10) return;
    setCreating(true);
    try {
      const newId = await duplicateBudgetAsVersion(budgetId, user.id, newVersionReason.trim());
      toast.success("Nova versão criada!");
      setDialogOpen(false);
      setNewVersionReason("");
      navigate(`/admin/budget/${newId}`);
    } catch (err: unknown) {
      toast.error((err instanceof Error ? err.message : null) || "Erro ao criar versão");
    }
    setCreating(false);
  };

  const currentVersionId = versions.find(v => v.is_current_version)?.id;

  const statusBadge = (v: Record<string, unknown>) => {
    const badges: React.ReactNode[] = [];
    if (v.is_current_version) {
      badges.push(
        <Badge key="atual" variant="outline" className="text-[10px] h-5 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
          ATUAL
        </Badge>
      );
    }
    if (v.is_published_version) {
      badges.push(
        <Badge key="pub" variant="outline" className="text-[10px] h-5 border-blue-500/50 text-blue-600 dark:text-blue-400 bg-blue-500/10">
          PUBLICADA
        </Badge>
      );
    }
    if (v.status === "superseded") {
      badges.push(
        <Badge key="sup" variant="outline" className="text-[10px] h-5 border-muted-foreground/30 text-muted-foreground bg-muted/50">
          SUBSTITUÍDA
        </Badge>
      );
    }
    return badges;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Timeline */}
      <div className="relative ml-4">
        {/* Vertical line */}
        <div className="absolute left-0 top-2 bottom-2 w-px bg-border" />

        <div className="space-y-0">
          {versions.map((v, idx) => {
            const isCurrent = v.is_current_version;
            const isViewing = v.id === budgetId;
            const reason = revisionReasons[v.id];

            return (
              <div key={v.id} className={cn("relative pl-7 py-4", idx < versions.length - 1 && "border-b border-border/30")}>
                {/* Timeline dot */}
                <div
                  className={cn(
                    "absolute left-[-5px] top-[22px] w-[10px] h-[10px] rounded-full border-2",
                    isCurrent
                      ? "bg-primary border-primary"
                      : "bg-background border-muted-foreground/40"
                  )}
                />

                <div className="space-y-1.5">
                  {/* Version badge + status */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs font-mono font-semibold h-5 px-2">
                      v{v.version_number}
                    </Badge>
                    {statusBadge(v)}
                    {isViewing && (
                      <span className="text-[10px] text-muted-foreground font-body italic">
                        (visualizando)
                      </span>
                    )}
                  </div>

                  {/* Author + timestamp */}
                  <p className="text-xs text-muted-foreground font-body">
                    Criada por <span className="font-medium text-foreground">{v.created_by_name || "—"}</span>
                    {v.created_at && <> em {formatDate(v.created_at)}</>}
                  </p>

                  {/* Change reason */}
                  {v.change_reason && (
                    <p className="text-xs text-muted-foreground font-body italic">
                      Motivo: {v.change_reason}
                    </p>
                  )}

                  {/* Revision reason */}
                  {reason && (
                    <div className="mt-1 px-2.5 py-1.5 rounded-md bg-warning/5 border border-warning/15 text-xs text-muted-foreground font-body">
                      📝 Revisão solicitada: {reason}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 mt-2">
                    {!isViewing && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => navigate(`/admin/budget/${v.id}`)}
                      >
                        <ExternalLink className="h-3 w-3" />
                        Ver orçamento
                      </Button>
                    )}
                    {currentVersionId && v.id !== currentVersionId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => navigate(`/admin/comparar?left=${v.id}&right=${currentVersionId}`)}
                      >
                        <GitCompare className="h-3 w-3" />
                        Comparar com atual
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Audit trail */}
      {auditEvents.length > 0 && (
        <details className="group">
          <summary className="flex items-center gap-2 text-xs font-body text-muted-foreground cursor-pointer hover:text-foreground transition-colors py-2">
            <Clock className="h-3 w-3" />
            Trilha de auditoria ({auditEvents.length} eventos)
          </summary>
          <div className="relative ml-6 border-l border-border mt-2">
            {auditEvents.map((evt) => (
              <div key={evt.id} className="pl-4 py-1.5 relative">
                <div className="absolute -left-[4px] top-[10px] w-2 h-2 rounded-full bg-muted-foreground/30" />
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
        </details>
      )}

      {/* Create new version + import */}
      <div className="flex items-center gap-2 pt-2 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Criar Nova Versão
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs text-muted-foreground"
          onClick={() => { setImportType("pdf"); setImportOpen(true); }}
        >
          <FileText className="h-3 w-3" /> Importar PDF
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs text-muted-foreground"
          onClick={() => { setImportType("excel"); setImportOpen(true); }}
        >
          <FileSpreadsheet className="h-3 w-3" /> Importar Planilha
        </Button>
      </div>

      {/* New version dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Criar Nova Versão</DialogTitle>
            <DialogDescription className="text-sm font-body text-muted-foreground">
              A versão atual será preservada. Descreva o motivo da nova versão (mínimo 10 caracteres).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <textarea
              value={newVersionReason}
              onChange={(e) => setNewVersionReason(e.target.value)}
              placeholder="Ex: Revisão de escopo solicitada pelo cliente para incluir área de serviço"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm font-body placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
            />
            <p className={cn(
              "text-xs font-body",
              newVersionReason.trim().length < 10 ? "text-muted-foreground" : "text-emerald-600 dark:text-emerald-400"
            )}>
              {newVersionReason.trim().length}/10 caracteres mínimos
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={creating || newVersionReason.trim().length < 10}
              onClick={handleCreateVersion}
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
              Criar versão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import modal */}
      <ImportExcelModal
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open);
          if (!open) loadData();
        }}
        fileFilter={importType}
        targetBudgetGroupId={groupId || budgetId}
      />
    </div>
  );
}
