import { useState, useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { formatBRL } from "@/lib/formatBRL";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useRef } from "react";

function AnimatedNumber({ value, prefix = "", suffix = "", className = "" }: { value: number; prefix?: string; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevValue = useRef(value);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const from = prevValue.current;
    const to = value;
    prevValue.current = to;
    const controls = animate(from, to, {
      duration: 0.4,
      ease: "easeOut",
      onUpdate(v) {
        if (Number.isInteger(to)) {
          node.textContent = `${prefix}${Math.round(v).toLocaleString("pt-BR")}${suffix}`;
        } else {
          node.textContent = `${prefix}${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}${suffix}`;
        }
      },
    });
    return () => controls.stop();
  }, [value, prefix, suffix]);

  return <span ref={ref} className={className}>{prefix}{Math.round(value).toLocaleString("pt-BR")}{suffix}</span>;
}

interface ROISimulatorProps {
  total: number;
}

export function ROISimulator({ total }: ROISimulatorProps) {
  const [dailyRate, setDailyRate] = useState(280);
  const [occupancy, setOccupancy] = useState(70);

  const metrics = useMemo(() => {
    const receita_mensal = dailyRate * 30 * (occupancy / 100);
    const payback_meses = receita_mensal > 0 ? Math.ceil(total / receita_mensal) : 0;
    const receita_anual = receita_mensal * 12;
    const roi_percentual = total > 0 ? Math.round((receita_anual / total) * 100) : 0;
    return { receita_mensal, payback_meses, receita_anual, roi_percentual };
  }, [dailyRate, occupancy, total]);

  const maxBar = Math.max(total, metrics.receita_anual, 1);
  const investmentWidth = (total / maxBar) * 100;
  const revenueWidth = (metrics.receita_anual / maxBar) * 100;

  return (
    <div className="border border-success/20 bg-success/[0.03] rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-success/10">
          <TrendingUp className="h-4 w-4 text-success" />
        </div>
        <h3 className="font-display font-bold text-sm text-foreground">Simulação de Retorno</h3>
      </div>

      {/* Inputs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <label className="text-xs text-muted-foreground font-body whitespace-nowrap">Diária média</label>
          <div className="relative w-[110px]">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-body">R$</span>
            <input
              type="number"
              value={dailyRate}
              onChange={(e) => setDailyRate(Math.max(0, Number(e.target.value)))}
              className="w-full h-8 rounded-md border border-input bg-background pl-8 pr-2 text-sm font-display font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground font-body">Ocupação</label>
            <span className="text-xs font-display font-bold text-foreground">{occupancy}%</span>
          </div>
          <Slider
            value={[occupancy]}
            onValueChange={([v]) => setOccupancy(v)}
            min={50}
            max={95}
            step={5}
            className="w-full"
          />
        </div>
      </div>

      {/* Main metric */}
      <div className="text-center py-2">
        <p className="text-xs text-muted-foreground font-body mb-0.5">Payback estimado</p>
        <div className="text-2xl font-display font-bold text-primary">
          <AnimatedNumber value={metrics.payback_meses} suffix=" meses" />
        </div>
        <p className="text-xs text-muted-foreground font-body mt-0.5">
          Após esse período, é retorno líquido.
        </p>
      </div>

      {/* Mini metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="text-center">
          <p className="text-xs text-muted-foreground font-body mb-0.5">Receita mensal</p>
          <p className="font-display font-semibold text-sm text-success">
            <AnimatedNumber value={metrics.receita_mensal} prefix="R$ " />
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground font-body mb-0.5">ROI anual</p>
          <p className="font-display font-semibold text-sm text-success">
            <AnimatedNumber value={metrics.roi_percentual} suffix="%" />
          </p>
        </div>
      </div>

      {/* Comparison bars */}
      <div className="space-y-2">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-body">Investimento</span>
            <span className="text-xs font-display font-semibold text-foreground">{formatBRL(total)}</span>
          </div>
          <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-primary/80"
              initial={{ width: 0 }}
              animate={{ width: `${investmentWidth}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-body">Receita 12 meses</span>
            <span className="text-xs font-display font-semibold text-success">{formatBRL(metrics.receita_anual)}</span>
          </div>
          <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-success/80"
              initial={{ width: 0 }}
              animate={{ width: `${revenueWidth}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground italic font-body mt-3">
        Projeção estimada para studios na região. Resultados reais dependem de localização e gestão.
      </p>
    </div>
  );
}
