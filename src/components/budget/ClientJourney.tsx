import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { motion } from "framer-motion";
import { Video, Box, RefreshCw, FileText, ShieldCheck, Hammer, Monitor, Award } from "lucide-react";

const steps = [
  {
    icon: Video,
    title: "Briefing com Arquitetura",
    summary: "Levantamento de informações para elaboração certeira do projeto.",
    detail: "Primeira conversa para alinhar expectativas, estilo de vida, referências visuais e objetivos do projeto. Definimos juntos o escopo e prazos iniciais.",
  },
  {
    icon: Box,
    title: "Projeto 3D",
    summary: "Apresentação do projeto em maquete de alta definição com revisões.",
    detail: "Desenvolvimento completo de projeto em 3D com renders realistas. Inclui layout, especificação de materiais, iluminação e marcenaria sob medida.",
  },
  {
    icon: RefreshCw,
    title: "Medição Técnica",
    summary: "Medição detalhada do ambiente, garantindo a correta execução do executivo.",
    detail: "Medição precisa de todos os ambientes para garantir que o projeto executivo reflita fielmente as dimensões reais do espaço.",
  },
  {
    icon: FileText,
    title: "Projeto Executivo",
    summary: "Plantas detalhadas com dimensões exatas, projeto elétrico, especificações de materiais e acabamentos.",
    detail: "Memorial descritivo, plantas técnicas, detalhamentos e especificações para que a equipe de obra execute com precisão milimétrica.",
  },
  {
    icon: ShieldCheck,
    title: "Liberação da Obra",
    summary: "Emissão da ART no CREA e envio de toda documentação para que o condomínio libere a reforma.",
    detail: "Cuidamos de toda a documentação necessária: ART, aprovação no condomínio e demais burocracias para início da obra sem pendências.",
  },
  {
    icon: Hammer,
    title: "Início da Obra",
    summary: "Elaboração do cronograma e mobilização da equipe técnica para darmos o start oficial.",
    detail: "Gestão completa do canteiro: cronograma, compras, entregas, qualidade e segurança. Você não precisa se preocupar com nada.",
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
