import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { motion } from "framer-motion";
import { Video, Box, RefreshCw, FileText, ShieldCheck, Hammer, Monitor, Award } from "lucide-react";

const steps = [
  {
    icon: Video,
    title: "Briefing",
    summary: "Alinhamento de expectativas, estilo e objetivos do projeto.",
    detail: "Primeira conversa para definir escopo, referências visuais e prazos. O ponto de partida para um projeto sob medida.",
  },
  {
    icon: Box,
    title: "Projeto 3D",
    summary: "Maquete realista com revisões até sua aprovação.",
    detail: "Renders de alta definição com layout, materiais, iluminação e marcenaria. Você aprova cada detalhe antes da execução.",
  },
  {
    icon: RefreshCw,
    title: "Medição técnica",
    summary: "Levantamento preciso do espaço para o projeto executivo.",
    detail: "Medição de todos os ambientes para garantir que o projeto reflita fielmente as dimensões reais.",
  },
  {
    icon: FileText,
    title: "Projeto executivo",
    summary: "Plantas detalhadas com especificações de materiais e acabamentos.",
    detail: "Memorial descritivo, plantas técnicas e detalhamentos para execução com precisão milimétrica.",
  },
  {
    icon: ShieldCheck,
    title: "Liberação",
    summary: "ART no CREA e documentação para o condomínio.",
    detail: "Toda a burocracia resolvida pela nossa equipe: ART, aprovação condominial e demais exigências.",
  },
  {
    icon: Hammer,
    title: "Início da obra",
    summary: "Cronograma definido, equipe mobilizada.",
    detail: "Gestão completa do canteiro: cronograma, compras, entregas e controle de qualidade. Zero preocupação para você.",
  },
];

export function ClientJourney() {
  return (
    <div className="space-y-5">
      <h2 className="text-lg sm:text-xl font-display font-bold text-foreground">
        Sua jornada com a Bwild após assinatura do contrato
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
