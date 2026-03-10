import { Card, CardContent } from "@/components/ui/card";

const steps = [
  { num: 1, title: "Iniciar o projeto", desc: "Aprovação do orçamento e assinatura do contrato." },
  { num: 2, title: "Briefing com a Lorena", desc: "Videochamada para traduzir sua visão no Projeto 3D." },
  { num: 3, title: "Projeto 3D", desc: "Primeira versão de layout, iluminação, marcenaria e decoração." },
  { num: 4, title: "Revisões e aprovação", desc: "Ajustes até a versão final aprovada." },
  { num: 5, title: "Início da obra", desc: "Execução com acompanhamento no portal Bwild." },
];

export function NextSteps() {
  return (
    <Card className="border-border overflow-hidden">
      <CardContent className="p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-5">
        <h3 className="text-base sm:text-lg font-display font-bold text-foreground">
          O que acontece depois que você inicia
        </h3>

        <div className="relative pl-8">
          {/* Vertical connector line */}
          <div className="absolute left-[15px] top-2 bottom-2 w-px border-l-2 border-dashed border-primary/30" />

          <div className="space-y-4 sm:space-y-5">
            {steps.map((s) => (
              <div key={s.num} className="relative flex items-start gap-3 sm:gap-4">
                <div className="absolute -left-8 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] sm:text-xs font-display font-bold z-10">
                  {s.num}
                </div>
                <div className="pt-0.5 sm:pt-1">
                  <p className="text-xs sm:text-sm font-display font-semibold text-foreground">{s.title}</p>
                  <p className="text-[11px] sm:text-xs text-muted-foreground font-body mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[11px] sm:text-xs text-muted-foreground font-body italic pt-1 sm:pt-2">
          Você terá canal direto com engenheiro e gerente de relacionamento durante todo o processo.
        </p>
      </CardContent>
    </Card>
  );
}
