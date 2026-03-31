import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarIcon,
  Users,
  Hammer,
  Briefcase,
  Clock,
  CheckCircle2,
  FileText,
  Loader2,
} from "lucide-react";

interface ProfileMap {
  [userId: string]: string;
}

interface BudgetRow {
  id: string;
  internal_status: string;
  estimator_owner_id: string | null;
  commercial_owner_id: string | null;
  created_at: string | null;
}

interface PersonMetrics {
  name: string;
  total: number;
  pending: number; // requested, triage, assigned
  inProgress: number; // in_progress
  finished: number; // done, published, contrato_fechado
}

const PENDING_STATUSES = ["requested", "novo", "triage", "assigned"];
const IN_PROGRESS_STATUSES = ["in_progress", "review"];
const FINISHED_STATUSES = ["done", "delivered", "published", "contrato_fechado", "closed_won"];

export function TeamMetricsPanel() {
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileMap>({});
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data: b }, { data: p }] = await Promise.all([
        supabase
          .from("budgets")
          .select("id, internal_status, estimator_owner_id, commercial_owner_id, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name"),
      ]);

      setBudgets(b || []);
      const map: ProfileMap = {};
      (p || []).forEach((prof) => {
        map[prof.id] = prof.full_name || "(sem nome)";
      });
      setProfiles(map);
      setLoading(false);
    }
    load();
  }, []);

  const filteredBudgets = useMemo(() => {
    return budgets.filter((b) => {
      if (!b.created_at) return true;
      const d = new Date(b.created_at);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        if (d > endOfDay) return false;
      }
      return true;
    });
  }, [budgets, dateFrom, dateTo]);

  const estimatorMetrics = useMemo(() => {
    const map = new Map<string, PersonMetrics>();

    filteredBudgets.forEach((b) => {
      if (!b.estimator_owner_id) return;
      const id = b.estimator_owner_id;
      if (!map.has(id)) {
        map.set(id, {
          name: profiles[id] || "(sem nome)",
          total: 0,
          pending: 0,
          inProgress: 0,
          finished: 0,
        });
      }
      const m = map.get(id)!;
      m.total++;
      if (PENDING_STATUSES.includes(b.internal_status)) m.pending++;
      else if (IN_PROGRESS_STATUSES.includes(b.internal_status)) m.inProgress++;
      else if (FINISHED_STATUSES.includes(b.internal_status)) m.finished++;
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredBudgets, profiles]);

  const commercialMetrics = useMemo(() => {
    const map = new Map<string, PersonMetrics>();

    filteredBudgets.forEach((b) => {
      if (!b.commercial_owner_id) return;
      const id = b.commercial_owner_id;
      if (!map.has(id)) {
        map.set(id, {
          name: profiles[id] || "(sem nome)",
          total: 0,
          pending: 0,
          inProgress: 0,
          finished: 0,
        });
      }
      const m = map.get(id)!;
      m.total++;
      if (PENDING_STATUSES.includes(b.internal_status)) m.pending++;
      else if (IN_PROGRESS_STATUSES.includes(b.internal_status)) m.inProgress++;
      else if (FINISHED_STATUSES.includes(b.internal_status)) m.finished++;
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredBudgets, profiles]);

  // Global totals
  const globalMetrics = useMemo(() => {
    const total = filteredBudgets.length;
    const pending = filteredBudgets.filter((b) => PENDING_STATUSES.includes(b.internal_status)).length;
    const inProgress = filteredBudgets.filter((b) => IN_PROGRESS_STATUSES.includes(b.internal_status)).length;
    const finished = filteredBudgets.filter((b) => FINISHED_STATUSES.includes(b.internal_status)).length;
    return { total, pending, inProgress, finished };
  }, [filteredBudgets]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const clearDates = () => { setDateFrom(undefined); setDateTo(undefined); };

  return (
    <div className="space-y-6">
      {/* Header + Date Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="font-display font-bold text-lg text-foreground">Métricas da Equipe</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DatePicker label="De" date={dateFrom} onSelect={setDateFrom} />
          <DatePicker label="Até" date={dateTo} onSelect={setDateTo} />
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={clearDates} className="text-xs">
              Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Global KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard icon={FileText} label="Total" value={globalMetrics.total} color="text-foreground" />
        <MetricCard icon={Clock} label="Pendentes" value={globalMetrics.pending} color="text-amber-600" />
        <MetricCard icon={Hammer} label="Em elaboração" value={globalMetrics.inProgress} color="text-blue-600" />
        <MetricCard icon={CheckCircle2} label="Finalizados" value={globalMetrics.finished} color="text-green-600" />
      </div>

      {/* Estimator breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Hammer className="h-4 w-4 text-blue-500" />
            Orçamentistas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {estimatorMetrics.length === 0 ? (
            <p className="text-sm text-muted-foreground font-body">Nenhum orçamento atribuído no período.</p>
          ) : (
            <div className="space-y-3">
              {estimatorMetrics.map((m) => (
                <PersonRow key={m.name} metrics={m} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Commercial breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-green-500" />
            Comercial
          </CardTitle>
        </CardHeader>
        <CardContent>
          {commercialMetrics.length === 0 ? (
            <p className="text-sm text-muted-foreground font-body">Nenhum orçamento atribuído no período.</p>
          ) : (
            <div className="space-y-3">
              {commercialMetrics.map((m) => (
                <PersonRow key={m.name} metrics={m} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PersonRow({ metrics: m }: { metrics: PersonMetrics }) {
  const total = m.pending + m.inProgress + m.finished;
  const pendingPct = total > 0 ? (m.pending / total) * 100 : 0;
  const inProgressPct = total > 0 ? (m.inProgress / total) * 100 : 0;
  const finishedPct = total > 0 ? (m.finished / total) * 100 : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-body font-medium text-foreground">{m.name}</span>
        <span className="text-xs font-body text-muted-foreground">{m.total} orçamentos</span>
      </div>
      <div className="flex gap-2 text-xs font-body">
        <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400">
          {m.pending} pendentes
        </Badge>
        <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400">
          {m.inProgress} em elaboração
        </Badge>
        <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-400">
          {m.finished} finalizados
        </Badge>
      </div>
      {/* Progress bar */}
      <div className="h-2 rounded-full bg-muted overflow-hidden flex">
        {pendingPct > 0 && (
          <div className="bg-amber-400 h-full" style={{ width: `${pendingPct}%` }} />
        )}
        {inProgressPct > 0 && (
          <div className="bg-blue-500 h-full" style={{ width: `${inProgressPct}%` }} />
        )}
        {finishedPct > 0 && (
          <div className="bg-green-500 h-full" style={{ width: `${finishedPct}%` }} />
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <Card className="border bg-card">
      <CardContent className="p-4 flex items-center gap-3">
        <Icon className={`h-4 w-4 ${color} shrink-0`} />
        <div>
          <p className={`text-xl font-display font-bold ${color}`}>{value}</p>
          <p className="text-xs text-muted-foreground font-body">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DatePicker({ label, date, onSelect }: { label: string; date?: Date; onSelect: (d: Date | undefined) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "justify-start text-left font-body text-xs gap-1.5",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onSelect}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}
