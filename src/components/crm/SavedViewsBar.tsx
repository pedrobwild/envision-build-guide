import { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronDown,
  Pin,
  PinOff,
  Plus,
  Save,
  Share2,
  Trash2,
  Users as UsersIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  useCreateSavedView,
  useDeleteSavedView,
  useSavedViews,
  useUpdateSavedView,
  type SavedView,
  type SavedViewEntity,
} from "@/hooks/useSavedViews";

interface SavedViewsBarProps<TFilters extends Record<string, unknown>> {
  entity: SavedViewEntity;
  /** Current filter state (will be persisted as JSON when saving). */
  currentFilters: TFilters;
  /** Apply a saved view's filters to the page state. */
  onApply: (filters: TFilters) => void;
  /** Optional id of currently applied view (controlled). */
  activeViewId?: string | null;
  onActiveViewChange?: (viewId: string | null) => void;
  /** True when current filters differ from the active view (enables "Update"). */
  hasChanges?: boolean;
  className?: string;
}

export function SavedViewsBar<TFilters extends Record<string, unknown>>({
  entity,
  currentFilters,
  onApply,
  activeViewId: controlledActiveId,
  onActiveViewChange,
  hasChanges,
  className,
}: SavedViewsBarProps<TFilters>) {
  const { data: views = [], isLoading } = useSavedViews(entity);
  const create = useCreateSavedView();
  const update = useUpdateSavedView();
  const remove = useDeleteSavedView();

  const [internalActiveId, setInternalActiveId] = useState<string | null>(null);
  const activeId = controlledActiveId !== undefined ? controlledActiveId : internalActiveId;
  const setActiveId = (id: string | null) => {
    setInternalActiveId(id);
    onActiveViewChange?.(id);
  };

  const [open, setOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newShared, setNewShared] = useState(false);
  const [newDefault, setNewDefault] = useState(false);

  const activeView = useMemo(
    () => views.find((v) => v.id === activeId) ?? null,
    [views, activeId],
  );

  // Auto-apply the user's default on first load (only if no view is currently selected)
  useEffect(() => {
    if (isLoading || activeId) return;
    const def = views.find((v) => v.is_default && !v.is_shared);
    if (def) {
      setActiveId(def.id);
      onApply(def.filters as TFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  function applyView(v: SavedView) {
    setActiveId(v.id);
    onApply(v.filters as TFilters);
    setOpen(false);
  }

  function clearView() {
    setActiveId(null);
    setOpen(false);
  }

  async function handleSave() {
    if (!newName.trim()) return;
    const created = await create.mutateAsync({
      entity,
      name: newName.trim(),
      filters: currentFilters,
      is_shared: newShared,
      is_default: newDefault,
    });
    setActiveId(created.id);
    setSaveDialogOpen(false);
    setNewName("");
    setNewShared(false);
    setNewDefault(false);
  }

  async function handleUpdateCurrent() {
    if (!activeView) return;
    await update.mutateAsync({
      id: activeView.id,
      patch: { filters: currentFilters },
    });
  }

  async function handleToggleDefault(v: SavedView) {
    await update.mutateAsync({
      id: v.id,
      patch: { is_default: !v.is_default },
    });
  }

  async function handleToggleShared(v: SavedView) {
    await update.mutateAsync({
      id: v.id,
      patch: { is_shared: !v.is_shared },
    });
  }

  async function handleDelete(v: SavedView) {
    await remove.mutateAsync({ id: v.id, entity });
    if (activeId === v.id) setActiveId(null);
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 max-w-[260px]"
          >
            {activeView ? (
              <BookmarkCheck className="h-3.5 w-3.5 text-primary shrink-0" />
            ) : (
              <Bookmark className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate font-body">
              {activeView ? activeView.name : "Visões"}
            </span>
            {hasChanges && activeView && (
              <span
                className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0"
                aria-label="Alterações não salvas"
              />
            )}
            <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-1.5" align="start">
          <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Minhas visões
          </div>
          {isLoading ? (
            <div className="px-2 py-3 text-xs text-muted-foreground">Carregando…</div>
          ) : views.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground">
              Nenhuma visão salva ainda. Salve a combinação atual de filtros para reutilizá-la depois.
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {views.map((v) => {
                const isActive = v.id === activeId;
                return (
                  <div
                    key={v.id}
                    className={cn(
                      "group flex items-center gap-1 rounded px-2 py-1.5 text-sm hover:bg-muted/60",
                      isActive && "bg-muted",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => applyView(v)}
                      className="flex-1 flex items-center gap-1.5 text-left min-w-0"
                    >
                      {isActive ? (
                        <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                      ) : (
                        <span className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="truncate">{v.name}</span>
                      {v.is_default && (
                        <Pin className="h-3 w-3 text-primary/70 shrink-0" />
                      )}
                      {v.is_shared && (
                        <Badge variant="outline" className="h-4 px-1 text-[9px] gap-0.5">
                          <UsersIcon className="h-2.5 w-2.5" />
                          Equipe
                        </Badge>
                      )}
                    </button>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        title={v.is_default ? "Remover como padrão" : "Definir como padrão"}
                        onClick={() => handleToggleDefault(v)}
                      >
                        {v.is_default ? (
                          <PinOff className="h-3 w-3" />
                        ) : (
                          <Pin className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        title={v.is_shared ? "Tornar privada" : "Compartilhar com equipe"}
                        onClick={() => handleToggleShared(v)}
                      >
                        <Share2
                          className={cn(
                            "h-3 w-3",
                            v.is_shared && "text-primary",
                          )}
                        />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive/80 hover:text-destructive"
                        title="Remover visão"
                        onClick={() => handleDelete(v)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="border-t border-border mt-1 pt-1">
            {activeView && (
              <button
                type="button"
                onClick={clearView}
                className="w-full text-left px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 rounded"
              >
                Limpar visão ativa
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setSaveDialogOpen(true);
              }}
              className="w-full text-left px-2 py-1.5 text-xs flex items-center gap-1.5 hover:bg-muted/60 rounded"
            >
              <Plus className="h-3 w-3" /> Salvar filtros atuais como visão…
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {activeView && hasChanges && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1 text-xs"
          onClick={handleUpdateCurrent}
          disabled={update.isPending}
          title="Atualizar a visão com os filtros atuais"
        >
          <Save className="h-3 w-3" /> Atualizar
        </Button>
      )}

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Salvar visão</DialogTitle>
            <DialogDescription>
              Os filtros atuais serão salvos com este nome para reuso rápido.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="view-name" className="text-xs">
                Nome
              </Label>
              <Input
                id="view-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex.: Meus leads quentes"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newName.trim()) {
                    e.preventDefault();
                    void handleSave();
                  }
                }}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium">Definir como padrão</p>
                <p className="text-xs text-muted-foreground">
                  Aplica esta visão automaticamente ao abrir a página.
                </p>
              </div>
              <Switch checked={newDefault} onCheckedChange={setNewDefault} />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium">Compartilhar com a equipe</p>
                <p className="text-xs text-muted-foreground">
                  Outros usuários poderão aplicar esta visão (somente leitura).
                </p>
              </div>
              <Switch checked={newShared} onCheckedChange={setNewShared} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!newName.trim() || create.isPending}
            >
              Salvar visão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
