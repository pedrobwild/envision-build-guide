import { useState } from "react";
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfQuarter, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "@/hooks/useDashboardMetrics";

interface PeriodFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const presets = [
  { label: "Hoje", fn: () => ({ from: new Date(), to: new Date() }) },
  { label: "7 dias", fn: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { label: "30 dias", fn: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { label: "Mês atual", fn: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { label: "Mês anterior", fn: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: "Trimestre", fn: () => ({ from: startOfQuarter(new Date()), to: new Date() }) },
  { label: "Ano atual", fn: () => ({ from: startOfYear(new Date()), to: new Date() }) },
];

export function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  const [open, setOpen] = useState(false);
  const [tempRange, setTempRange] = useState<{ from?: Date; to?: Date }>({
    from: value.from,
    to: value.to,
  });

  const handlePreset = (preset: (typeof presets)[0]) => {
    const range = preset.fn();
    onChange(range);
    setTempRange(range);
    setOpen(false);
  };

  const handleApply = () => {
    if (tempRange.from && tempRange.to) {
      onChange({ from: tempRange.from, to: tempRange.to });
      setOpen(false);
    }
  };

  const label = `${format(value.from, "dd MMM", { locale: ptBR })} — ${format(value.to, "dd MMM yyyy", { locale: ptBR })}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 font-body text-xs h-8 px-3 bg-background border-border hover:bg-muted"
        >
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="hidden sm:inline">{label}</span>
          <span className="sm:hidden">Período</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end" sideOffset={8}>
        <div className="flex flex-col sm:flex-row">
          {/* Presets */}
          <div className="border-b sm:border-b-0 sm:border-r border-border p-3 space-y-1 min-w-[140px]">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Atalhos
            </p>
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => handlePreset(p)}
                className="w-full text-left text-xs font-body px-2 py-1.5 rounded-md hover:bg-muted text-foreground transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Calendar */}
          <div className="p-3">
            <Calendar
              mode="range"
              selected={tempRange as any}
              onSelect={(range: any) => setTempRange(range || {})}
              numberOfMonths={2}
              locale={ptBR}
              className="pointer-events-auto"
            />
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              <div className="text-xs text-muted-foreground font-body">
                {tempRange.from && tempRange.to
                  ? `${format(tempRange.from, "dd/MM")} — ${format(tempRange.to, "dd/MM/yyyy")}`
                  : "Selecione um intervalo"}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleApply}
                  disabled={!tempRange.from || !tempRange.to}
                >
                  Aplicar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
