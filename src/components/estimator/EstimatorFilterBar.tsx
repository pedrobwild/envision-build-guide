import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  User,
  ArrowUpDown,
  UserCog,
  X,
  SlidersHorizontal,
} from "lucide-react";
import {
  INTERNAL_STATUSES,
  PRIORITIES,
} from "@/lib/role-constants";

export type SortOption = "urgente" | "recente" | "prazo";

interface FilterOption {
  id: string;
  name: string;
}

interface EstimatorFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  priorityFilter: string;
  onPriorityFilterChange: (value: string) => void;
  commercialFilter: string;
  onCommercialFilterChange: (value: string) => void;
  estimatorFilter: string;
  onEstimatorFilterChange: (value: string) => void;
  sortBy: SortOption;
  onSortByChange: (value: SortOption) => void;
  commercialOptions: FilterOption[];
  estimatorOptions: FilterOption[];
  isAdmin: boolean;
  filteredCount: number;
}

export function EstimatorFilterBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  commercialFilter,
  onCommercialFilterChange,
  estimatorFilter,
  onEstimatorFilterChange,
  sortBy,
  onSortByChange,
  commercialOptions,
  estimatorOptions,
  isAdmin,
  filteredCount,
}: EstimatorFilterBarProps) {
  const hasActiveFilters =
    statusFilter !== "all" ||
    priorityFilter !== "all" ||
    commercialFilter !== "all" ||
    estimatorFilter !== "all" ||
    search.length > 0;

  const activeFilterCount = [
    statusFilter !== "all",
    priorityFilter !== "all",
    commercialFilter !== "all",
    estimatorFilter !== "all",
  ].filter(Boolean).length;

  const clearAll = () => {
    onSearchChange("");
    onStatusFilterChange("all");
    onPriorityFilterChange("all");
    onCommercialFilterChange("all");
    onEstimatorFilterChange("all");
  };

  return (
    <div className="hidden lg:block space-y-2">
      {/* Main filter row */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente, projeto, bairro..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-muted flex items-center justify-center hover:bg-muted-foreground/20"
            >
              <X className="h-2.5 w-2.5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-border" />

        {/* Status */}
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className={`w-[160px] h-8 text-xs ${statusFilter !== "all" ? "border-primary/40 bg-primary/5" : ""}`}>
            <SlidersHorizontal className="h-3 w-3 mr-1 shrink-0" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="_pending">📥 Pendentes</SelectItem>
            <SelectItem value="_in_progress">🔨 Em Elaboração</SelectItem>
            <SelectItem value="ready_for_review">📋 Em Revisão</SelectItem>
            <SelectItem value="_delivered">📤 Entregues</SelectItem>
            <SelectItem value="_finished">📦 Encerrados</SelectItem>
            <div className="h-px bg-border my-1" />
            {Object.entries(INTERNAL_STATUSES).map(([key, { label, icon }]) => (
              <SelectItem key={key} value={key}>{icon} {label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Priority */}
        <Select value={priorityFilter} onValueChange={onPriorityFilterChange}>
          <SelectTrigger className={`w-[130px] h-8 text-xs ${priorityFilter !== "all" ? "border-primary/40 bg-primary/5" : ""}`}>
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Prioridade</SelectItem>
            {Object.entries(PRIORITIES).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Admin-only filters */}
        {isAdmin && commercialOptions.length > 0 && (
          <Select value={commercialFilter} onValueChange={onCommercialFilterChange}>
            <SelectTrigger className={`w-[150px] h-8 text-xs ${commercialFilter !== "all" ? "border-primary/40 bg-primary/5" : ""}`}>
              <User className="h-3 w-3 mr-1 shrink-0" />
              <SelectValue placeholder="Comercial" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Comercial</SelectItem>
              {commercialOptions.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {isAdmin && estimatorOptions.length > 0 && (
          <Select value={estimatorFilter} onValueChange={onEstimatorFilterChange}>
            <SelectTrigger className={`w-[150px] h-8 text-xs ${estimatorFilter !== "all" ? "border-primary/40 bg-primary/5" : ""}`}>
              <UserCog className="h-3 w-3 mr-1 shrink-0" />
              <SelectValue placeholder="Orçamentista" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Orçamentista</SelectItem>
              {estimatorOptions.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Divider */}
        <div className="h-5 w-px bg-border" />

        {/* Sort */}
        <Select value={sortBy} onValueChange={(v) => onSortByChange(v as SortOption)}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <ArrowUpDown className="h-3 w-3 mr-1 shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="urgente">Mais urgente</SelectItem>
            <SelectItem value="prazo">Prazo próximo</SelectItem>
            <SelectItem value="recente">Mais recente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Active filters summary */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 text-xs font-body text-muted-foreground">
          <span className="flex items-center gap-1">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-mono">
              {filteredCount}
            </Badge>
            resultado{filteredCount !== 1 ? "s" : ""}
          </span>

          {activeFilterCount > 0 && (
            <>
              <span>·</span>
              <span>{activeFilterCount} filtro{activeFilterCount > 1 ? "s" : ""} ativo{activeFilterCount > 1 ? "s" : ""}</span>
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-[11px] text-primary hover:text-primary gap-0.5"
            onClick={clearAll}
          >
            <X className="h-3 w-3" />
            Limpar
          </Button>
        </div>
      )}
    </div>
  );
}
