import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

const features = [
  "Projetos e documentos",
  "Cronograma atualizado",
  "Relatórios semanais",
  "Progresso da obra",
  "Fluxo de pagamentos",
  "Canal direto com engenheiro",
];

const placeholders = ["Cronograma", "Financeiro", "Relatórios"];

export function PortalShowcase() {
  return (
    <Card className="border-border overflow-hidden">
      <CardContent className="p-5 sm:p-6 space-y-5">
        <div>
          <h3 className="text-base sm:text-lg font-display font-bold text-foreground">
            Acompanhe tudo em tempo real
          </h3>
          <p className="text-sm text-muted-foreground font-body mt-1">
            Transparência total: documentos, etapas, pagamentos e próximos passos.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {features.map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm font-body text-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
              <span>{f}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {placeholders.map((p) => (
            <div
              key={p}
              className="aspect-video rounded-lg bg-muted/60 border border-border flex items-center justify-center"
            >
              <span className="text-[11px] text-muted-foreground font-body">[{p}]</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground font-body">
          Sistema web e mobile disponível durante toda a obra.
        </p>
      </CardContent>
    </Card>
  );
}
