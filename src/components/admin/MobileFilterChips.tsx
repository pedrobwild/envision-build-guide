import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, AlertTriangle, Flame, User, Clock, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterChip {
  id: string;
  label: string;
  icon?: React.ElementType;
  color?: string;
  count?: number;
}

interface MobileFilterChipsProps {
  chips: FilterChip[];
  activeChipId: string;
  onChipChange: (chipId: string) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  /** Quantidade de itens após aplicar busca + filtros. */
  resultCount?: number;
  /** Total bruto antes dos filtros (denominador do contador). */
  totalCount?: number;
}

export function MobileFilterChips({
  chips,
  activeChipId,
  onChipChange,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  resultCount,
  totalCount,
}: MobileFilterChipsProps) {
  const showCounter =
    typeof resultCount === "number" &&
    typeof totalCount === "number" &&
    (Boolean(searchValue) || (activeChipId !== "all" && resultCount !== totalCount));
  // Mantém a barra de busca aberta sempre que houver termo digitado, para
  // o usuário não "perder" a busca ao colapsar acidentalmente em mobile.
  const [searchOpen, setSearchOpen] = useState(() => Boolean(searchValue));
  const inputRef = useRef<HTMLInputElement>(null);

  // Sincroniza estado quando a busca for setada externamente (ex.: visões salvas).
  useEffect(() => {
    if (searchValue && !searchOpen) setSearchOpen(true);
  }, [searchValue, searchOpen]);

  useEffect(() => {
    if (searchOpen && inputRef.current && !searchValue) {
      // Foca apenas quando o usuário acabou de abrir manualmente
      inputRef.current.focus();
    }
  }, [searchOpen, searchValue]);

  const handleClearSearch = () => {
    onSearchChange("");
    inputRef.current?.focus();
  };

  const handleCollapseSearch = () => {
    // Só permite colapsar quando o termo está vazio — assim a busca não
    // some sem aviso e o usuário sempre vê o que filtrou.
    if (!searchValue) setSearchOpen(false);
  };

  return (
    <div className="lg:hidden space-y-2">
      {/* Search bar — expandable */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full h-9 pl-9 pr-9 rounded-lg border border-border bg-card text-sm font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                inputMode="search"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
              />
              <button
                onClick={searchValue ? handleClearSearch : handleCollapseSearch}
                aria-label={searchValue ? "Limpar busca" : "Fechar busca"}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-muted flex items-center justify-center hover:bg-muted-foreground/20"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contador de resultados — só aparece quando há busca ou filtro ativo */}
      {showCounter && (
        <div
          className="flex items-center gap-1 text-[11px] font-mono tabular-nums text-muted-foreground px-1"
          aria-live="polite"
        >
          <span className="font-semibold text-foreground">{resultCount}</span>
          <span>de {totalCount} resultado{totalCount === 1 ? "" : "s"}</span>
        </div>
      )}

      {/* Chips row */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1 pb-0.5">

        {!searchOpen && (
          <button
            onClick={() => setSearchOpen(true)}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-body font-medium whitespace-nowrap flex-shrink-0 transition-colors border",
              searchValue
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:bg-muted/50"
            )}
          >
            <Search className="h-3 w-3" />
            {searchValue ? searchValue.slice(0, 10) + (searchValue.length > 10 ? "…" : "") : "Buscar"}
          </button>
        )}

        {/* Filter chips */}
        {chips.map((chip) => {
          const isActive = chip.id === activeChipId;
          const Icon = chip.icon;
          return (
            <button
              key={chip.id}
              onClick={() => onChipChange(chip.id === activeChipId && chip.id !== "all" ? "all" : chip.id)}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-body font-medium whitespace-nowrap flex-shrink-0 transition-all border",
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-muted-foreground border-border hover:bg-muted/50 active:scale-95"
              )}
            >
              {Icon && <Icon className="h-3 w-3" />}
              {chip.label}
              {chip.count != null && chip.count > 0 && (
                <span className={cn(
                  "text-[9px] rounded-full px-1 min-w-[14px] text-center",
                  isActive
                    ? "bg-primary-foreground/20"
                    : chip.color === "destructive"
                      ? "bg-destructive/15 text-destructive"
                      : "bg-muted"
                )}>
                  {chip.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
