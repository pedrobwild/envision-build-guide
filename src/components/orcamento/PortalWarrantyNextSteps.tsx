import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, MessageCircle, Calendar, ShieldCheck, FileText, BarChart3, Clock } from "lucide-react";
import type { PortalTab } from "@/lib/orcamento-types";

const LABEL = "text-[10px] uppercase tracking-[0.08em] font-body font-semibold text-muted-foreground/60";
const MONO = "font-mono tabular-nums";

interface PortalWarrantyNextStepsProps {
  portalTabs: PortalTab[];
}

const tabIcons: Record<string, typeof BarChart3> = {
  evolucao: BarChart3,
  documentos: FileText,
  pagamentos: Clock,
  cronograma: Calendar,
};

const warrantyBullets = [
  "Vistoria final com checklist completo",
  "Manual de uso e manutenção da obra",
  "Certificado de garantia estrutural de 5 anos",
  "Canal ágil para atendimento pós-obra",
];

export function PortalWarrantyNextSteps({ portalTabs }: PortalWarrantyNextStepsProps) {
  return (
    <section className="space-y-6">
      {/* Portal */}
      <div className="space-y-3">
        <div>
          <p className={`${LABEL} mb-1`}>Acompanhamento</p>
          <h2 className="text-lg sm:text-xl font-display font-bold text-foreground tracking-tight leading-[1.15]">
            Portal Bwild
          </h2>
        </div>
        <p className="text-sm text-muted-foreground font-body tracking-[-0.01em]">
          Acompanhe cada etapa da sua obra em tempo real.
        </p>
        <Tabs defaultValue={portalTabs[0]?.id} className="w-full">
          <TabsList className="w-full justify-start bg-muted/50 h-auto flex-wrap gap-0">
            {portalTabs.map((tab) => {
              const Icon = tabIcons[tab.id] || FileText;
              return (
                <TabsTrigger key={tab.id} value={tab.id} className="text-xs gap-1.5 font-body data-[state=active]:bg-background">
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {portalTabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="mt-3">
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="aspect-video bg-muted/30 rounded-md border border-dashed border-border flex items-center justify-center mb-3">
                    <p className="text-xs text-muted-foreground font-body">Screenshot do portal — {tab.label}</p>
                  </div>
                  <ul className="space-y-1.5">
                    {tab.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm font-body text-foreground leading-snug tracking-[-0.01em]">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Warranty */}
      <Card>
        <CardContent className="pt-5 pb-4 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <p className="text-sm font-display font-bold text-foreground tracking-[-0.02em]">Entrega e garantia</p>
          </div>
          <p className="text-sm text-muted-foreground font-body tracking-[-0.01em]">
            Sua obra entregue com documentação completa e garantia estrutural.
          </p>
          <ul className="space-y-1.5">
            {warrantyBullets.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm font-body text-foreground leading-snug tracking-[-0.01em]">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Next steps */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-5 pb-4 space-y-4 text-center">
          <p className="text-sm font-display font-bold text-foreground tracking-[-0.02em]">Próximo passo</p>
          <p className="text-xs text-muted-foreground font-body tracking-[-0.01em]">
            Primeiro passo para iniciar seu Projeto 3D.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" className="gap-2 w-full sm:w-auto font-body">
              <Calendar className="h-4 w-4" />
              Agendar briefing com a arquiteta
            </Button>
            <Button variant="outline" size="lg" className="gap-2 w-full sm:w-auto font-body">
              <MessageCircle className="h-4 w-4" />
              Falar no WhatsApp
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
