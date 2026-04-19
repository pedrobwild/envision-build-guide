import { useState } from "react";
import { Archive, Tag, UserCog, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useBulkAddTags,
  useBulkArchive,
  useBulkAssignOwner,
} from "@/hooks/useBulkClientActions";

interface TeamMember {
  id: string;
  full_name: string;
}

interface BulkActionsBarProps {
  selectedIds: string[];
  totalSelectableCount: number;
  onClear: () => void;
  comerciais: TeamMember[];
}

export function BulkActionsBar({
  selectedIds,
  totalSelectableCount,
  onClear,
  comerciais,
}: BulkActionsBarProps) {
  const assignOwner = useBulkAssignOwner();
  const addTags = useBulkAddTags();
  const archive = useBulkArchive();

  const [ownerOpen, setOwnerOpen] = useState(false);
  const [ownerValue, setOwnerValue] = useState<string>("__unassigned__");

  const [tagsOpen, setTagsOpen] = useState(false);
  const [tagsInput, setTagsInput] = useState("");

  const [archiveOpen, setArchiveOpen] = useState(false);

  const count = selectedIds.length;
  if (count === 0) return null;

  async function applyOwner() {
    const ownerId = ownerValue === "__unassigned__" ? null : ownerValue;
    await assignOwner.mutateAsync({ clientIds: selectedIds, ownerId });
    setOwnerOpen(false);
    onClear();
  }

  async function applyTags() {
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (tags.length === 0) return;
    await addTags.mutateAsync({ clientIds: selectedIds, tags });
    setTagsOpen(false);
    setTagsInput("");
    onClear();
  }

  async function applyArchive() {
    await archive.mutateAsync({ clientIds: selectedIds });
    setArchiveOpen(false);
    onClear();
  }

  return (
    <div className="sticky top-2 z-30 flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 backdrop-blur px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={onClear}
          title="Limpar seleção"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
        <span className="text-sm font-medium tabular-nums">
          {count} selecionado{count === 1 ? "" : "s"}
        </span>
        <span className="text-xs text-muted-foreground hidden sm:inline">
          de {totalSelectableCount} visíveis
        </span>
      </div>

      <div className="flex items-center gap-1.5 ml-auto flex-wrap">
        {/* Atribuir responsável */}
        <Popover open={ownerOpen} onOpenChange={setOwnerOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              <UserCog className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Responsável</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Atribuir responsável</Label>
              <Select value={ownerValue} onValueChange={setOwnerValue}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned__">— Sem responsável</SelectItem>
                  {comerciais.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full h-9"
              onClick={applyOwner}
              disabled={assignOwner.isPending}
            >
              Aplicar a {count}
            </Button>
          </PopoverContent>
        </Popover>

        {/* Tags */}
        <Popover open={tagsOpen} onOpenChange={setTagsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Tags</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Adicionar tags (separadas por vírgula)</Label>
              <Input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Ex.: alto-padrão, retomar"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void applyTags();
                  }
                }}
              />
              <p className="text-[10px] text-muted-foreground">
                Tags existentes nos clientes serão preservadas.
              </p>
            </div>
            <Button
              className="w-full h-9"
              onClick={applyTags}
              disabled={!tagsInput.trim() || addTags.isPending}
            >
              Aplicar a {count}
            </Button>
          </PopoverContent>
        </Popover>

        {/* Arquivar */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-destructive hover:text-destructive"
          onClick={() => setArchiveOpen(true)}
        >
          <Archive className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Arquivar</span>
        </Button>
      </div>

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Arquivar {count} cliente{count === 1 ? "" : "s"}?</DialogTitle>
            <DialogDescription>
              Os clientes selecionados sairão da carteira ativa, mas o histórico de
              orçamentos é preservado. Você pode reativá-los depois pelo banco.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setArchiveOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={applyArchive}
              disabled={archive.isPending}
            >
              Arquivar {count}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
