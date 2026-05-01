import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { restoreBudget, purgeBudget } from "@/lib/budget-delete";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, RefreshCw, Trash2, Undo2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DeletedRow {
  id: string;
  sequential_code: string | null;
  client_name: string | null;
  project_name: string | null;
  internal_status: string | null;
  deleted_at: string;
  deleted_by: string | null;
  created_at: string;
}

export default function TrashPage() {
  const [rows, setRows] = useState<DeletedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_deleted_budgets", { p_limit: 500 });
    if (error) {
      toast.error("Falha ao carregar lixeira", { description: error.message });
      setRows([]);
    } else {
      setRows((data as DeletedRow[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRestore(id: string, label: string) {
    setBusyId(id);
    const r = await restoreBudget(id);
    setBusyId(null);
    if (!r.ok) {
      toast.error("Não foi possível restaurar", { description: r.reason });
      return;
    }
    toast.success(`${label} restaurado`);
    setRows((prev) => prev.filter((row) => row.id !== id));
  }

  async function handlePurge(id: string, label: string) {
    setBusyId(id);
    const r = await purgeBudget(id);
    setBusyId(null);
    if (!r.ok) {
      toast.error("Não foi possível excluir definitivamente", { description: r.reason });
      return;
    }
    toast.success(`${label} excluído permanentemente`);
    setRows((prev) => prev.filter((row) => row.id !== id));
  }

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            to="/admin/sistema"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Sistema
          </Link>
          <h1 className="text-2xl font-display tracking-tight mt-1">Lixeira de orçamentos</h1>
          <p className="text-sm text-muted-foreground">
            Orçamentos movidos para a lixeira ficam ocultos para todos os usuários, mas permanecem no
            banco e podem ser restaurados a qualquer momento.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">Código</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Projeto</TableHead>
              <TableHead className="w-[150px]">Status</TableHead>
              <TableHead className="w-[170px]">Excluído em</TableHead>
              <TableHead className="w-[200px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                  Lixeira vazia.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const label = r.sequential_code || r.project_name || r.client_name || "Orçamento";
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.sequential_code || "—"}</TableCell>
                    <TableCell>{r.client_name || "—"}</TableCell>
                    <TableCell className="max-w-[280px] truncate" title={r.project_name || ""}>
                      {r.project_name || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.internal_status || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(r.deleted_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRestore(r.id, label)}
                          disabled={busyId === r.id}
                        >
                          <Undo2 className="h-3.5 w-3.5 mr-1" />
                          Restaurar
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              disabled={busyId === r.id}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir definitivamente?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação remove <strong>{label}</strong> e todos os seus dados
                                (seções, itens, imagens, ajustes, ambientes e tours) do banco. Não
                                pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handlePurge(r.id, label)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir permanentemente
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
