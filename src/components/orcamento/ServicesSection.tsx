import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronDown, ChevronUp, ArrowRight, Check, X } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import type { ServiceCard } from "@/lib/orcamento-types";

const LABEL = "text-[10px] uppercase tracking-[0.08em] font-body font-semibold";

interface ServicesSectionProps {
  services: ServiceCard[];
}

const whyBwild = [
  "Projeto + obra gerenciados por um único time",
  "Engenheiro dedicado com visitas semanais",
  "Portal digital com transparência total",
  "Sem surpresas: orçamento fechado com escopo definido",
  "Garantia estrutural de 5 anos",
];

const comparison = [
  { aspect: "Projeto", traditional: "Padrão", bwild: "Personalizado" },
  { aspect: "Comunicação", traditional: "WhatsApp disperso", bwild: "Portal centralizado" },
  { aspect: "Coordenação", traditional: "Cliente coordena", bwild: "Engenharia gerencia" },
  { aspect: "Execução", traditional: "Improviso", bwild: "Projeto executivo" },
];

export function ServicesSection({ services }: ServicesSectionProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="space-y-6">
      <div>
        <p className={`${LABEL} text-muted-foreground/60 mb-1`}>Serviços</p>
        <h2 className="text-lg sm:text-xl font-display font-bold text-foreground tracking-tight leading-[1.15]">
          O que a Bwild faz por você
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {services.map((s) => {
          const isOpen = openId === s.id;
          return (
            <Collapsible key={s.id} open={isOpen} onOpenChange={(o) => setOpenId(o ? s.id : null)}>
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-display tracking-[-0.02em]">{s.title}</CardTitle>
                  <p className="text-sm text-muted-foreground font-body leading-snug tracking-[-0.01em]">{s.valueProp}</p>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-primary px-0 h-auto font-body text-xs tracking-[-0.01em]">
                      {isOpen ? "Ocultar detalhes" : "Ver detalhes"}
                      {isOpen ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3">
                    <ul className="space-y-1.5">
                      {s.includes.map((inc) => (
                        <li key={inc} className="flex items-start gap-2 text-xs font-body text-foreground leading-snug tracking-[-0.01em]">
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                          <span>{inc}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-start gap-2 bg-muted/50 rounded-md px-3 py-2">
                      <ArrowRight className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                      <p className="text-xs font-body font-medium text-foreground leading-snug tracking-[-0.01em]">{s.result}</p>
                    </div>
                  </CollapsibleContent>
                </CardContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>

      {/* Why Bwild */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <p className={`${LABEL} text-foreground mb-3`}>
            Por que clientes escolhem a Bwild
          </p>
          <ul className="space-y-1.5">
            {whyBwild.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm font-body text-foreground leading-snug tracking-[-0.01em]">
                <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Comparison table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="grid grid-cols-3 text-xs font-display font-semibold bg-muted/50 tracking-[-0.01em]">
          <div className="px-3 py-2.5" />
          <div className="px-3 py-2.5 text-muted-foreground">Tradicional</div>
          <div className="px-3 py-2.5 text-primary">Bwild</div>
        </div>
        {comparison.map((row, i) => (
          <div key={row.aspect} className={`grid grid-cols-3 text-xs font-body ${i % 2 === 0 ? "bg-background" : "bg-muted/20"}`}>
            <div className="px-3 py-2.5 font-medium text-foreground tracking-[-0.01em]">{row.aspect}</div>
            <div className="px-3 py-2.5 text-muted-foreground flex items-center gap-1.5 tracking-[-0.01em]">
              <X className="h-3 w-3 text-destructive flex-shrink-0" />
              {row.traditional}
            </div>
            <div className="px-3 py-2.5 text-foreground flex items-center gap-1.5 tracking-[-0.01em]">
              <Check className="h-3 w-3 text-primary flex-shrink-0" />
              {row.bwild}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
