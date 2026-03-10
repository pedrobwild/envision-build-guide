import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { motion } from "framer-motion";
import { Video, Box, RefreshCw, FileText, ShieldCheck, Hammer, Monitor, Award } from "lucide-react";

const steps = [
  {
    icon: Video,
    title: "Briefing com a Lorena",
    summary: "Videochamada para entender estilo, objetivos e referências.",
    detail: "Primeira conversa para alinhar expectativas, estilo de vida, referências visuais e objetivos do projeto. Definimos juntos o escopo e prazos iniciais.",
  },
  {
    icon: Box,
    title: "Projeto 3D",
    summary: "Layout, iluminação, marcenaria e decoração personalizados.",
    detail: "Desenvolvimento completo de projeto em 3D com renders realistas. Inclui layout, especificação de materiais, iluminação e marcenaria sob medida.",
  },
  {
    icon: RefreshCw,
    title: "Revisões e aprovação",
    summary: "Ajustes até a aprovação final do projeto.",
    detail: "Rodadas de ajustes para garantir que cada detalhe esteja perfeito antes de iniciar a execução. Sem surpresas, sem improvisos.",
  },
  {
    icon: FileText,
    title: "Projeto executivo",
    summary: "Documentação técnica completa para a obra.",
    detail: "Memorial descritivo, plantas técnicas, detalhamentos e especificações para que a equipe de obra execute com precisão milimétrica.",
  },
  {
    icon: ShieldCheck,
    title: "Liberação e burocracias",
    summary: "Aprovação no CREA, ART e condomínio.",
    detail: "Cuidamos de toda a documentação necessária: ART, aprovação no condomínio e demais burocracias para início da obra sem pendências.",
  },
  {
    icon: Hammer,
    title: "Execução da obra",
    summary: "Coordenação de mão de obra, materiais e fornecedores.",
    detail: "Gestão completa do canteiro: cronograma, compras, entregas, qualidade e segurança. Você não precisa se preocupar com nada.",
  },
  {
    icon: Monitor,
    title: "Acompanhamento digital",
    summary: "Portal com relatórios semanais e contato direto.",
    detail: "Acesso ao portal Bwild com fotos da obra, relatórios de progresso, documentos financeiros e canal direto com o engenheiro responsável.",
  },
  {
    icon: Award,
    title: "Entrega e garantia",
    summary: "Vistoria final, manual de obra e garantia de 5 anos.",
    detail: "Vistoria detalhada com checklist completo. Entregamos manual de uso e manutenção, além de certificado de garantia estrutural de 5 anos.",
  },
];

export function ClientJourney() {
  return (
    <div className="space-y-5">
      <h2 className="text-lg sm:text-xl font-display font-bold text-foreground">
        Sua jornada com a Bwild — do briefing à entrega
      </h2>

      {/* Desktop: horizontal stepper */}
      <div className="hidden md:block">
        <div className="relative flex items-start justify-between">
          {/* Connector line */}
          <div className="absolute top-5 left-[5%] right-[5%] h-px border-t-2 border-dashed border-primary/30" />

          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.35 }}
              className="relative flex flex-col items-center text-center w-[12%] z-10"
            >
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-display font-bold shadow-md">
                {i + 1}
              </div>
              <step.icon className="h-4 w-4 text-primary mt-2" />
              <p className="text-xs font-display font-semibold text-foreground mt-1 leading-tight">{step.title}</p>
              <p className="text-xs text-muted-foreground font-body mt-0.5 leading-tight">{step.summary}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Mobile + expandable details */}
      <Accordion type="single" collapsible className="md:mt-6">
        {steps.map((step, i) => (
          <AccordionItem key={step.title} value={`step-${i}`} className="border-border">
            <AccordionTrigger className="hover:no-underline gap-3 py-3">
              <div className="flex items-center gap-3 text-left">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-display font-bold">
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm font-display font-semibold text-foreground">{step.title}</p>
                  <p className="text-xs text-muted-foreground font-body">{step.summary}</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pl-14 text-sm text-muted-foreground font-body">
              <p className="font-semibold text-foreground text-xs mb-1">O que acontece nesta etapa</p>
              {step.detail}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
