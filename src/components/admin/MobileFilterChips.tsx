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
}

export function MobileFilterChips({
  chips,
  activeChipId,
  onChipChange,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar...",
}: MobileFilterChipsProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [searchOpen]);

  const handleCloseSearch = () => {
    setSearchOpen(false);
    onSearchChange("");
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
              />
              <button
                onClick={handleCloseSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-muted flex items-center justify-center"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chips row */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1 pb-0.5">
        {/* Search toggle chip */}
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
