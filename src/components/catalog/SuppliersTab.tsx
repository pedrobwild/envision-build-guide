import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Search, Plus, Edit2, Trash2, Building2, ToggleLeft, ToggleRight,
  ArrowRightLeft, Loader2,
} from "lucide-react";
import { CatalogEmptyState } from "@/components/catalog/CatalogEmptyState";
import type { Supplier } from "@/components/catalog/SupplierDialog";

const SUBCATEGORIAS_PRESTADORES = [
  "Marcenaria", "Empreita", "Vidraçaria Box", "Vidraçaria Sacada",
  "Eletricista", "Pintor", "Instalador de Piso", "Técnico Ar-Condicionado",
  "Gesseiro", "Serviços Gerais", "Limpeza", "Pedreiro",
  "Instalador Fechadura Digital", "Cortinas", "Marmoraria", "Jardim Vertical",
];

const SUBCATEGORIAS_PRODUTOS = [
  "Eletrodomésticos", "Enxoval", "Espelhos", "Decoração", "Revestimentos",
  "Luminárias", "Torneiras", "Cadeiras e Mesas", "Camas", "Sofás e Poltronas",
  "Tapeçaria", "Torneiras e Cubas", "Materiais Elétricos",
  "Materiais de Construção", "Acessórios Banheiro", "Fechadura Digital", "Tintas",
];

function getTipo(categoria: string | null | undefined): string {
  if (!categoria) return "—";
  if (SUBCATEGORIAS_PRESTADORES.includes(categoria)) return "Prestadores";
  if (SUBCATEGORIAS_PRODUTOS.includes(categoria)) return "Produtos";
  return "—";
}

interface DeleteTarget {
  supplier: Supplier;
  priceCount: number;
  itemCount: number;
}

interface Props {
  suppliers: Supplier[];
  onNewSupplier: () => void;
  onEditSupplier: (sup: Supplier) => void;
  onRefresh: () => void;
}

export function SuppliersTab({ suppliers, onNewSupplier, onEditSupplier, onRefresh }: Props) {
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState("all");
  const [subcategoriaFilter, setSubcategoriaFilter] = useState("all");
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const subcategoriasDisponiveis = tipoFilter === "Prestadores"
    ? SUBCATEGORIAS_PRESTADORES
    : tipoFilter === "Produtos"
      ? SUBCATEGORIAS_PRODUTOS
      : [...SUBCATEGORIAS_PRESTADORES, ...SUBCATEGORIAS_PRODUTOS].sort();

  const filtered = suppliers.filter((s) => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) &&
        !s.contact_info?.toLowerCase().includes(search.toLowerCase())) return false;
    if (tipoFilter !== "all") {
      const tipo = getTipo(s.categoria);
      if (tipo !== tipoFilter) return false;
    }
    if (subcategoriaFilter !== "all") {
      if (s.categoria !== subcategoriaFilter) return false;
    }
    return true;
  });

  const handleToggleActive = async (sup: Supplier) => {
    const { error } = await supabase
      .from("suppliers")
      .update({ is_active: !sup.is_active })
      .eq("id", sup.id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success(sup.is_active ? "Fornecedor desativado" : "Fornecedor ativado");
    onRefresh();
  };

  const handleDeleteClick = async (sup: Supplier) => {
    const [{ count: priceCount }, { count: itemCount }] = await Promise.all([
      supabase.from("catalog_item_supplier_prices")
        .select("*", { count: "exact", head: true })
        .eq("supplier_id", sup.id),
      supabase.from("catalog_items")
        .select("*", { count: "exact", head: true })
        .eq("default_supplier_id", sup.id),
    ]);
    setDeleteTarget({ supplier: sup, priceCount: priceCount ?? 0, itemCount: itemCount ?? 0 });
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("suppliers").delete().eq("id", deleteTarget.supplier.id);
    setDeleting(false);
    if (error) {
      toast.error("Erro ao excluir. Remova os vínculos (preços e itens) antes de excluir este fornecedor.");
      setDeleteDialogOpen(false);
      return;
    }
    toast.success("Fornecedor excluído");
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
    onRefresh();
  };

  const handleSyncSupplier = async (sup: Supplier) => {
    setSyncingId(sup.id);
    try {
      const res = await supabase.functions.invoke("sync-supplier-outbound", {
        body: { supplier_id: sup.id },
      });
      if (res.error) throw new Error(res.error.message);
      const result = res.data?.results?.[0];
      if (result?.status === "success") {
        toast.success(`"${sup.name}" sincronizado com o Portal BWild`);
      } else {
        toast.error(`Falha ao sincronizar: ${result?.error ?? "erro desconhecido"}`);
      }
    } catch (err: unknown) {
      toast.error(`Erro na sincronização: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar fornecedores..."
            className="pl-9"
          />
        </div>
        <Select value={tipoFilter} onValueChange={(v) => { setTipoFilter(v); setSubcategoriaFilter("all"); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="Prestadores">Prestadores</SelectItem>
            <SelectItem value="Produtos">Produtos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={subcategoriaFilter} onValueChange={setSubcategoriaFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Subcategoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas subcategorias</SelectItem>
            {subcategoriasDisponiveis.map((sub) => (
              <SelectItem key={sub} value={sub}>{sub}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={onNewSupplier}>
          <Plus className="h-4 w-4 mr-1" /> Novo Fornecedor
        </Button>
      </div>

      {filtered.length === 0 ? (
        <CatalogEmptyState
          icon={Building2}
          title={search || tipoFilter !== "all" ? "Nenhum fornecedor encontrado" : "Nenhum fornecedor"}
          description={search || tipoFilter !== "all" ? "Tente outro termo ou filtro." : "Cadastre fornecedores para vincular aos itens do catálogo."}
          action={!search && tipoFilter === "all" ? (
            <Button size="sm" onClick={onNewSupplier}>
              <Plus className="h-4 w-4 mr-1" /> Novo Fornecedor
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Subcategoria</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((sup) => {
                const tipo = getTipo(sup.categoria);
                return (
                  <TableRow key={sup.id} className={!sup.is_active ? "opacity-50" : ""}>
                    <TableCell className="font-medium">{sup.name}</TableCell>
                    <TableCell>
                      {tipo !== "—" ? (
                        <Badge variant="outline" className={`text-xs ${tipo === "Prestadores" ? "bg-primary/15 text-primary border-primary/30" : "bg-secondary text-secondary-foreground border-secondary"}`}>
                          {tipo}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {sup.categoria ? (
                        <Badge variant="outline" className="text-xs bg-muted/50 text-foreground/80 border-border">
                          {sup.categoria}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{sup.contact_info ?? "—"}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleToggleActive(sup)}
                        className="group flex items-center gap-1.5"
                        title={sup.is_active ? "Desativar" : "Ativar"}
                      >
                        {sup.is_active ? (
                          <ToggleRight className="h-5 w-5 text-primary group-hover:text-primary/70 transition-colors" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                        )}
                        <span className="text-xs">{sup.is_active ? "Ativo" : "Inativo"}</span>
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-0.5 justify-end">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={syncingId === sup.id}
                                onClick={() => handleSyncSupplier(sup)}
                              >
                                {syncingId === sup.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <ArrowRightLeft className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Sincronizar com Portal BWild</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Button variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => onEditSupplier(sup)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteClick(sup)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{deleteTarget?.supplier.name}"?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span>Esta ação não pode ser desfeita.</span>
              {deleteTarget && (deleteTarget.priceCount > 0 || deleteTarget.itemCount > 0) && (
                <span className="block mt-2 text-destructive font-medium">
                  Isso afetará {deleteTarget.priceCount > 0 && `${deleteTarget.priceCount} preço(s) vinculado(s)`}
                  {deleteTarget.priceCount > 0 && deleteTarget.itemCount > 0 && " e "}
                  {deleteTarget.itemCount > 0 && `${deleteTarget.itemCount} item(ns) com este fornecedor como padrão`}.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
