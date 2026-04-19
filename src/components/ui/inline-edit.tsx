import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Check, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export type InlineEditType = "text" | "currency" | "date" | "select";

export interface InlineEditOption {
  value: string;
  label: string;
}

interface InlineEditProps {
  value: string | number | null | undefined;
  type?: InlineEditType;
  /** Display string when not editing. If omitted, value is rendered with sensible default. */
  display?: React.ReactNode;
  placeholder?: string;
  options?: InlineEditOption[];
  /** Called with the new normalized value (string for text/select/date in ISO, number for currency). */
  onSave: (next: string | number | null) => Promise<void> | void;
  className?: string;
  /** Disable editing entirely. */
  disabled?: boolean;
  /** Optional aria-label for accessibility. */
  ariaLabel?: string;
}

function formatBRL(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function parseCurrency(input: string): number | null {
  const cleaned = input.replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Reusable inline edit with click-to-edit, blur-to-save and Esc-to-cancel.
 * Supports text, currency, date (ISO yyyy-mm-dd) and select types.
 */
export function InlineEdit({
  value,
  type = "text",
  display,
  placeholder = "—",
  options,
  onSave,
  className,
  disabled,
  ariaLabel,
}: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function startEdit(e: React.MouseEvent) {
    if (disabled) return;
    e.stopPropagation();
    if (type === "currency") {
      setDraft(value != null && value !== "" ? String(value) : "");
    } else if (type === "date") {
      setDraft(value ? String(value).slice(0, 10) : "");
    } else {
      setDraft(value != null ? String(value) : "");
    }
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setDraft("");
  }

  async function commit(rawDraft?: string) {
    const d = rawDraft ?? draft;
    let next: string | number | null = d;
    if (type === "currency") next = d.trim() === "" ? null : parseCurrency(d);
    if (type === "date") next = d || null;
    if (type === "text" || type === "select") next = d.trim() === "" ? null : d;

    // No-op if unchanged
    const original = value ?? null;
    const normalizedOriginal =
      type === "date" && original ? String(original).slice(0, 10) : original;
    if (next === normalizedOriginal) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  }

  // Render — Select uses a Popover-controlled trigger
  if (type === "select" && options) {
    const selectedLabel = options.find((o) => o.value === value)?.label ?? null;
    return (
      <Popover open={editing} onOpenChange={(o) => (o ? setEditing(true) : cancel())}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label={ariaLabel}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "group inline-flex items-center gap-1 rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 text-left",
              "hover:bg-muted/60 transition-colors",
              disabled && "cursor-default hover:bg-transparent",
              className,
            )}
          >
            <span className={cn("truncate", !selectedLabel && "text-muted-foreground")}>
              {display ?? selectedLabel ?? placeholder}
            </span>
            {!disabled && (
              <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 shrink-0 transition-opacity" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-56 p-1"
          align="start"
          onClick={(e) => e.stopPropagation()}
        >
          <Select
            value={value ? String(value) : ""}
            onValueChange={(v) => {
              setDraft(v);
              void commit(v);
            }}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-sm">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PopoverContent>
      </Popover>
    );
  }

  if (editing) {
    return (
      <div
        className="inline-flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <Input
          ref={inputRef}
          type={type === "date" ? "date" : type === "currency" ? "text" : "text"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={onKey}
          disabled={saving}
          inputMode={type === "currency" ? "decimal" : undefined}
          className="h-7 text-xs px-2 min-w-[6rem]"
          aria-label={ariaLabel}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onMouseDown={(e) => {
            e.preventDefault();
            void commit();
          }}
          aria-label="Confirmar"
        >
          <Check className="h-3 w-3 text-success" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onMouseDown={(e) => {
            e.preventDefault();
            cancel();
          }}
          aria-label="Cancelar"
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </Button>
      </div>
    );
  }

  // Display mode
  let displayed: React.ReactNode = display;
  if (displayed == null) {
    if (type === "currency") {
      displayed = formatBRL(typeof value === "number" ? value : Number(value));
    } else if (type === "date" && value) {
      const d = new Date(String(value));
      displayed = isNaN(d.getTime())
        ? placeholder
        : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    } else if (value == null || value === "") {
      displayed = <span className="text-muted-foreground">{placeholder}</span>;
    } else {
      displayed = String(value);
    }
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "group inline-flex items-center gap-1 rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 text-left max-w-full",
        "hover:bg-muted/60 transition-colors",
        disabled && "cursor-default hover:bg-transparent",
        className,
      )}
    >
      <span className="truncate">{displayed}</span>
      {!disabled && (
        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 shrink-0 transition-opacity" />
      )}
    </button>
  );
}
