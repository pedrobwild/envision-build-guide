import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Loader2,
  ArrowRightLeft,
  Send,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SyncLogRow {
  id: string;
  source_system: string;
  target_system: string;
  entity_type: string;
  source_id: string;
  target_id: string | null;
  sync_status: string;
  error_message: string | null;
  attempts: number | null;
  created_at: string | null;
  synced_at: string | null;
  payload: any;
}

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  success: { icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", label: "Sucesso" },
  failed: { icon: XCircle, color: "text-destructive", label: "Falhou" },
  pending: { icon: Clock, color: "text-amber-600 dark:text-amber-400", label: "Pendente" },
  skipped: { icon: ArrowUpDown, color: "text-muted-foreground", label: "Ignorado" },
};

export default function IntegrationSyncPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [retrying, setRetrying] = useState(false);

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["integration-sync-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_sync_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as SyncLogRow[];
    },
    refetchInterval: 30_000,
  });

  const stats = {
    total: logs.length,
    success: logs.filter((l) => l.sync_status === "success").length,
    failed: logs.filter((l) => l.sync_status === "failed").length,
    pending: logs.filter((l) => l.sync_status === "pending").length,
  };

  const retryFailed = useMutation({
    mutationFn: async () => {
      setRetrying(true);
      const res = await supabase.functions.invoke("sync-supplier-outbound", {
        body: { action: "retry_failed" },
      });
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (data) => {
      const results = data?.results ?? [];
      const ok = results.filter((r: any) => r.status === "success").length;
      toast({
        title: "Retry concluído",
        description: `${ok}/${results.length} fornecedores sincronizados com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: ["integration-sync-log"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro no retry", description: err.message, variant: "destructive" });
    },
    onSettled: () => setRetrying(false),
  });

  const formatTime = (date: string | null) => {
    if (!date) return "—";
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
    } catch {
      return "—";
    }
  };

  const getDirection = (source: string) => {
    if (source === "envision") return { label: "Envision → Portal", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" };
    return { label: "Portal → Envision", color: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300" };
  };

  return (
    <Card className="border bg-card">
      <CardContent className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2.5 rounded-lg">
              <ArrowRightLeft className="h-5 w-5 text-foreground/70" />
            </div>
            <div>
              <h2 className="text-lg font-display font-semibold text-foreground">
                Monitor de Integração
              </h2>
              <p className="text-sm text-muted-foreground font-body mt-0.5">
                Sincronização de fornecedores entre Envision e Portal BWild
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            disabled={isLoading}
            className="shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", value: stats.total, color: "text-foreground" },
            { label: "Sucesso", value: stats.success, color: "text-emerald-600 dark:text-emerald-400" },
            { label: "Falhas", value: stats.failed, color: "text-destructive" },
            { label: "Pendentes", value: stats.pending, color: "text-amber-600 dark:text-amber-400" },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-lg border bg-muted/40 p-3 text-center"
            >
              <p className="text-xs text-muted-foreground font-body">{kpi.label}</p>
              <p className={`text-2xl font-display font-bold ${kpi.color}`}>
                {isLoading ? "…" : kpi.value}
              </p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => retryFailed.mutate()}
            disabled={retrying || stats.failed === 0}
          >
            {retrying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Retentar falhas ({stats.failed})
          </Button>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground font-body">
            Nenhum registro de sincronização encontrado.
          </div>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead>Direção</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead className="hidden sm:table-cell">Tentativas</TableHead>
                  <TableHead className="hidden md:table-cell">Erro</TableHead>
                  <TableHead className="text-right">Quando</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const statusCfg = STATUS_CONFIG[log.sync_status] ?? STATUS_CONFIG.pending;
                  const StatusIcon = statusCfg.icon;
                  const direction = getDirection(log.source_system);

                  return (
                    <TableRow key={log.id}>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1.5">
                                <StatusIcon className={`h-4 w-4 ${statusCfg.color}`} />
                                <span className="text-xs font-medium">{statusCfg.label}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>{log.sync_status}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`text-[10px] ${direction.color}`}>
                          {direction.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.entity_type}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-center">
                        {log.attempts ?? 0}
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-[200px]">
                        {log.error_message ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs text-destructive truncate block">
                                  {log.error_message}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-sm">
                                <p className="text-xs">{log.error_message}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                        {formatTime(log.synced_at ?? log.created_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
