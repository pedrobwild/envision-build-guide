import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { TrendingUp, CalendarDays, DollarSign, Sun } from "lucide-react";
import { formatBRL } from "@/lib/formatBRL";
import { motion } from "framer-motion";

interface InvestmentImpactProps {
  neighborhood: string;
  squareMeters: number;
}

const BASE_DAILY = 220;
const REFORMED_DAILY = 290;
const DAILY_GAIN = REFORMED_DAILY - BASE_DAILY;

export function InvestmentImpact({ neighborhood, squareMeters }: InvestmentImpactProps) {
  const [occupancy, setOccupancy] = useState(75);

  const occupancyRate = occupancy / 100;
  const monthlyGain = DAILY_GAIN * occupancyRate * 30;
  const annualGain = monthlyGain * 12;

  const metrics = [
    { icon: Sun, label: "Diária estimada hoje", value: formatBRL(BASE_DAILY) },
    { icon: TrendingUp, label: "Diária estimada após reforma", value: formatBRL(REFORMED_DAILY) },
    { icon: CalendarDays, label: "Ganho mensal estimado", value: formatBRL(monthlyGain) },
    { icon: DollarSign, label: "Ganho anual estimado", value: formatBRL(annualGain) },
  ];

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg sm:text-xl font-display text-foreground">
          Impacto estimado da reforma no seu investimento
        </CardTitle>
        <p className="text-sm text-muted-foreground font-body">
          Bairro: <span className="font-semibold text-foreground">{neighborhood}</span> · {squareMeters}m²
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="short-stay">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="short-stay">Short Stay</TabsTrigger>
            <TabsTrigger value="moradia">Moradia</TabsTrigger>
            <TabsTrigger value="revenda">Revenda</TabsTrigger>
          </TabsList>

          <TabsContent value="short-stay" className="space-y-6 mt-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {metrics.map((m, i) => (
                <motion.div
                  key={m.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.35 }}
                  className="rounded-xl border border-primary/15 bg-primary/5 p-4 text-center space-y-2"
                >
                  <m.icon className="h-5 w-5 mx-auto text-primary" />
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide leading-tight">{m.label}</p>
                  <p className="text-lg font-display font-bold text-foreground">{m.value}</p>
                </motion.div>
              ))}
            </div>

            <div className="space-y-3 px-1">
              <div className="flex items-center justify-between text-sm font-body">
                <span className="text-muted-foreground">Taxa de ocupação</span>
                <span className="font-semibold text-foreground">{occupancy}%</span>
              </div>
              <Slider
                value={[occupancy]}
                onValueChange={(v) => setOccupancy(v[0])}
                min={0}
                max={100}
                step={1}
              />
            </div>
          </TabsContent>

          <TabsContent value="moradia" className="mt-4">
            <div className="rounded-xl border border-border bg-muted/30 p-8 text-center">
              <p className="text-sm text-muted-foreground font-body">
                Estimativas disponíveis para locação de curta temporada.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="revenda" className="mt-4">
            <div className="rounded-xl border border-border bg-muted/30 p-8 text-center">
              <p className="text-sm text-muted-foreground font-body">
                Estimativas disponíveis para locação de curta temporada.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <p className="text-[11px] text-muted-foreground/70 font-body leading-relaxed">
          Estimativas educacionais. Resultados variam com bairro, fotos, avaliações e operação.
        </p>
      </CardContent>
    </Card>
  );
}
