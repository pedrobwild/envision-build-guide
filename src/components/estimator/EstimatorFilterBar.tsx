import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  return (
    <div className="hidden lg:flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente, projeto, bairro..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={statusFilter} onValueChange={onStatusFilterChange}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Status" />
          {statusFilter !== "all" && (
            <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px] font-mono">
              {filteredCount}
            </Badge>
          )}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os status</SelectItem>
          <SelectItem value="_delivered">📤 Entregues</SelectItem>
          <SelectItem value="_finished">📦 Encerrados</SelectItem>
          {Object.entries(INTERNAL_STATUSES).map(([key, { label }]) => (
            <SelectItem key={key} value={key}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={priorityFilter} onValueChange={onPriorityFilterChange}>
        <SelectTrigger className="w-full sm:w-[150px]">
          <SelectValue placeholder="Prioridade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          {Object.entries(PRIORITIES).map(([key, { label }]) => (
            <SelectItem key={key} value={key}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isAdmin && commercialOptions.length > 0 && (
        <Select value={commercialFilter} onValueChange={onCommercialFilterChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <User className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue placeholder="Comercial" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os comerciais</SelectItem>
            {commercialOptions.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {isAdmin && estimatorOptions.length > 0 && (
        <Select value={estimatorFilter} onValueChange={onEstimatorFilterChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <UserCog className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue placeholder="Orçamentista" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os orçamentistas</SelectItem>
            {estimatorOptions.map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Select value={sortBy} onValueChange={(v) => onSortByChange(v as SortOption)}>
        <SelectTrigger className="w-full sm:w-[170px]">
          <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="urgente">Mais urgente</SelectItem>
          <SelectItem value="prazo">Prazo mais próximo</SelectItem>
          <SelectItem value="recente">Mais recente</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
