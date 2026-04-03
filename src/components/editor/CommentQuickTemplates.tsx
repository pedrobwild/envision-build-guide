import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, X, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { toast } from "sonner";

const DEFAULT_TEMPLATES = [
  "Aguardo retorno do comercial",
  "Informação solicitada ao cliente",
  "Orçamento revisado — pronto para envio",
  "Item aguardando cotação de fornecedor",
  "Prazo em risco — necessário alinhamento",
  "Alteração solicitada pelo cliente",
];

const STORAGE_KEY = "bwild_comment_templates";
const MAX_CUSTOM = 10;

function loadCustomTemplates(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCustomTemplates(templates: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

interface CommentQuickTemplatesProps {
  value: string;
  onChange: (value: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}

export function CommentQuickTemplates({ value, onChange, textareaRef }: CommentQuickTemplatesProps) {
  const [customTemplates, setCustomTemplates] = useState<string[]>(loadCustomTemplates);
  const [savePopoverOpen, setSavePopoverOpen] = useState(false);
  const [saveLabel, setSaveLabel] = useState("");
  const [commandOpen, setCommandOpen] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const allTemplates = [...DEFAULT_TEMPLATES, ...customTemplates];

  const insertTemplate = useCallback((text: string) => {
    const newValue = value.trim() ? `${value.trim()} ${text}` : text;
    onChange(newValue);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [value, onChange, textareaRef]);

  // Keyboard shortcut: `/` as first char opens command
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && el.value === "") {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, [textareaRef]);

  function handleSaveTemplate() {
    const label = saveLabel.trim();
    if (!label) return;
    if (customTemplates.length >= MAX_CUSTOM) {
      toast.error("Limite de 10 templates atingido. Exclua um para adicionar.");
      return;
    }
    const updated = [...customTemplates, label];
    setCustomTemplates(updated);
    saveCustomTemplates(updated);
    setSavePopoverOpen(false);
    setSaveLabel("");
    toast.success("Template salvo!");
  }

  function removeCustomTemplate(index: number) {
    const updated = customTemplates.filter((_, i) => i !== index);
    setCustomTemplates(updated);
    saveCustomTemplates(updated);
    toast("Template removido");
  }

  function handleLongPressStart(customIndex: number, e: React.MouseEvent | React.TouchEvent) {
    longPressTimer.current = setTimeout(() => {
      // Trigger context menu behavior via dropdown - handled by right-click instead
    }, 500);
  }

  function handleLongPressEnd() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }

  return (
    <>
      {/* Pill row */}
      <div className="flex gap-2 overflow-x-auto pb-1 mt-2 mb-1 scrollbar-hide items-center">
        {DEFAULT_TEMPLATES.map((tpl, i) => (
          <button
            key={`d-${i}`}
            type="button"
            onClick={() => insertTemplate(tpl)}
            className="rounded-full border px-3 py-1 text-xs font-medium cursor-pointer hover:bg-accent transition-colors whitespace-nowrap text-foreground border-border bg-background"
          >
            {tpl}
          </button>
        ))}

        {customTemplates.map((tpl, i) => (
          <DropdownMenu key={`c-${i}`}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={() => insertTemplate(tpl)}
                onContextMenu={(e) => e.preventDefault()}
                className="rounded-full border px-3 py-1 text-xs font-medium cursor-pointer hover:bg-accent transition-colors whitespace-nowrap text-primary border-primary/30 bg-primary/5"
              >
                {tpl}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[160px]">
              <DropdownMenuItem
                onClick={() => removeCustomTemplate(i)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Remover template
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ))}

        {/* Save as template */}
        <Popover open={savePopoverOpen} onOpenChange={setSavePopoverOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              onClick={() => {
                setSaveLabel(value.trim().slice(0, 50));
                setSavePopoverOpen(true);
              }}
              disabled={!value.trim()}
              className="rounded-full border border-dashed px-3 py-1 text-xs font-medium cursor-pointer hover:bg-accent transition-colors whitespace-nowrap text-muted-foreground border-border disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />
              Salvar
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-3 space-y-2">
            <p className="text-xs font-medium text-foreground font-body">Salvar como template</p>
            <Input
              value={saveLabel}
              onChange={(e) => setSaveLabel(e.target.value)}
              placeholder="Nome do template"
              className="h-8 text-sm"
              maxLength={80}
              onKeyDown={(e) => e.key === "Enter" && handleSaveTemplate()}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSavePopoverOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSaveTemplate} disabled={!saveLabel.trim()}>
                Salvar
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Command palette for `/` shortcut */}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Buscar template..." />
        <CommandList>
          <CommandEmpty>Nenhum template encontrado.</CommandEmpty>
          <CommandGroup heading="Templates">
            {allTemplates.map((tpl, i) => (
              <CommandItem
                key={i}
                value={tpl}
                onSelect={() => {
                  insertTemplate(tpl);
                  setCommandOpen(false);
                }}
              >
                {tpl}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
