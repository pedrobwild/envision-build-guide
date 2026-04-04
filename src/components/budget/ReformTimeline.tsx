import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, ChevronDown, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Etapa {
  id: number;
  titulo: string;
  descricao: string;
  inicio: string;
  fim: string;
  semana: string;
  isEntrega?: boolean;
}

const etapas: Etapa[] = [
  { id: 1, titulo: "Mobilização e alinhamento de projeto", descricao: "Mobilização de mão de obra, medições e alinhamento com o projeto executivo.", inicio: "06/04", fim: "10/04", semana: "Sem 1" },
  { id: 2, titulo: "Elétrica e infra de ar-condicionado", descricao: "Instalação de fechadura eletrônica, adequações elétricas e execução da infra de ar-condicionado.", inicio: "13/04", fim: "17/04", semana: "Sem 2" },
  { id: 3, titulo: "Demolições, luminárias e backsplash", descricao: "Demolições gerais, instalação de luminárias e instalação de backsplash.", inicio: "20/04", fim: "24/04", semana: "Sem 3" },
  { id: 4, titulo: "Nivelamento e piso vinílico", descricao: "Nivelamento do contrapiso e instalação do piso vinílico.", inicio: "27/04", fim: "01/05", semana: "Sem 4" },
  { id: 5, titulo: "Medição de marcenaria, box e espelhos", descricao: "Medição de marcenaria, início da produção das peças e instalação de box e espelhos.", inicio: "04/05", fim: "08/05", semana: "Sem 5" },
  { id: 6, titulo: "Drywall, shaft e metais", descricao: "Fechamento de shaft do ar-condicionado, execução de drywall e instalação de metais.", inicio: "11/05", fim: "15/05", semana: "Sem 6" },
  { id: 7, titulo: "Ar-condicionado e 1ª demão de pintura", descricao: "Instalação do ar-condicionado e primeira demão de pintura.", inicio: "18/05", fim: "22/05", semana: "Sem 7" },
  { id: 8, titulo: "Instalação de marcenaria", descricao: "Montagem e instalação de toda a marcenaria produzida.", inicio: "25/05", fim: "29/05", semana: "Sem 8" },
  { id: 9, titulo: "Ajustes, rodapé e acabamentos civis", descricao: "Ajustes finais de marcenaria, instalação de rodapé e acabamentos de civil.", inicio: "01/06", fim: "05/06", semana: "Sem 9" },
  { id: 10, titulo: "2ª pintura, elétrica final e acessórios", descricao: "Segunda demão de pintura, acabamentos elétricos e instalação de acessórios.", inicio: "08/06", fim: "12/06", semana: "Sem 10" },
  { id: 11, titulo: "Cortinas, eletros e mobiliário", descricao: "Instalação de cortinas, recebimento e instalação de eletrodomésticos e móveis soltos.", inicio: "15/06", fim: "19/06", semana: "Sem 11" },
  { id: 12, titulo: "Vistoria e entrega da unidade", descricao: "Vistoria Bwild, limpeza fina e vistoria com o cliente para entrega formal da unidade.", inicio: "22/06", fim: "25/06", semana: "Sem 12", isEntrega: true },
];

const MONO_STYLE: React.CSSProperties = { fontFeatureSettings: '"tnum" 1', letterSpacing: '-0.02em' };

export function ReformTimeline() {
  const [openId, setOpenId] = useState<number | null>(null);

  const toggle = (id: number) => setOpenId(openId === id ? null : id);

  return (
    <Card className="border-border overflow-hidden">
      <CardContent className="p-4 sm:p-5 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <CalendarDays className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-display font-bold text-foreground">
              Exemplo de Cronograma de Reforma
            </h3>
            <p className="text-xs text-muted-foreground font-body mt-0.5 tabular-nums">
              55 dias úteis · 12 etapas · Entrega em 25/06
            </p>
          </div>
        </div>

        {/* Progress bar — desktop only */}
        <div className="hidden md:block">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary/20"
              style={{ width: "100%" }}
            />
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-0">
          {etapas.map((etapa, index) => {
            const isOpen = openId === etapa.id;
            const isLast = index === etapas.length - 1;

            return (
              <div key={etapa.id} className="flex gap-3">
                {/* Vertical line + dot */}
                <div className="flex flex-col items-center flex-shrink-0 w-5">
                  <div
                    className={cn(
                      "w-2.5 h-2.5 rounded-full mt-3 flex-shrink-0 ring-2 ring-background transition-colors",
                      isLast
                        ? "bg-primary"
                        : isOpen
                          ? "bg-primary/60"
                          : "bg-muted-foreground/30"
                    )}
                  />
                  {!isLast && (
                    <div className="w-px flex-1 bg-border min-h-[16px]" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pb-2 min-w-0">
                  <button
                    onClick={() => toggle(etapa.id)}
                    aria-expanded={isOpen}
                    aria-controls={`etapa-detail-${etapa.id}`}
                    className={cn(
                      "w-full text-left rounded-lg px-3 py-2.5 md:px-4 md:py-3 transition-colors flex items-center justify-between gap-2",
                      "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-2px]",
                      isOpen ? "bg-muted/50" : "hover:bg-muted/30"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-display font-semibold uppercase tracking-wider text-muted-foreground">
                          {etapa.semana}
                        </span>
                        {isLast && (
                          <span className="text-[9px] font-display font-bold uppercase tracking-wider bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                            Entrega
                          </span>
                        )}
                      </div>
                      <p className={cn(
                        "text-sm md:text-[15px] leading-snug",
                        isLast ? "font-display font-bold text-foreground" : "font-body font-medium text-foreground"
                      )}>
                        {etapa.titulo}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className="text-[11px] md:text-xs text-muted-foreground font-mono tabular-nums whitespace-nowrap hidden sm:inline"
                        style={MONO_STYLE}
                      >
                        {etapa.inicio} → {etapa.fim}
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
                          isOpen && "rotate-180"
                        )}
                      />
                    </div>
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        id={`etapa-detail-${etapa.id}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 md:px-4 pt-1 pb-2 space-y-1.5">
                          <p className="text-xs md:text-sm text-muted-foreground font-body leading-relaxed">
                            {etapa.descricao}
                          </p>
                          <span
                            className="text-[11px] text-muted-foreground font-mono tabular-nums sm:hidden"
                            style={MONO_STYLE}
                          >
                            {etapa.inicio} → {etapa.fim}
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 pt-1 justify-center">
          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
          <p className="text-xs text-muted-foreground font-body">
            Cronograma detalhado definido após assinatura do contrato.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
