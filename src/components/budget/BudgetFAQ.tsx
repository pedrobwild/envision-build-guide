import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { motion } from "framer-motion";
import { HelpCircle } from "lucide-react";

const faqs = [
  {
    q: "O que acontece após aprovar este orçamento?",
    a: "Entramos em contato para assinar o contrato, alinhar o cronograma e definir a data de início. Você terá um engenheiro e um gerente de relacionamento dedicados desde o primeiro dia.",
  },
  {
    q: "Os valores podem mudar?",
    a: "Não. Dentro do prazo de validade, os valores são fixos. Eventuais alterações de escopo solicitadas por você geram aditivos, sempre acordados e aprovados antes da execução.",
  },
  {
    q: "Como funciona o pagamento?",
    a: "Parcelamento vinculado às etapas da obra, via PIX, transferência ou boleto. Condições personalizadas podem ser negociadas com sua consultora.",
  },
  {
    q: "Qual a garantia dos serviços?",
    a: "1 ano de garantia sobre a mão de obra. Materiais seguem a garantia do fabricante. Emitimos certificado formal na entrega da obra.",
  },
  {
    q: "Quanto tempo leva a reforma?",
    a: "Depende da complexidade do projeto. Antes de iniciar, você recebe um cronograma detalhado com marcos semanais e acompanhamento pelo nosso portal.",
  },
  {
    q: "Preciso acompanhar a obra pessoalmente?",
    a: "Não. Toda a gestão é feita pela nossa equipe. Você acompanha o progresso pelo portal Bwild, com fotos, relatórios e canal direto com o engenheiro.",
  },
];

export function BudgetFAQ() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="rounded-lg border border-border bg-card p-4 sm:p-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <HelpCircle className="h-5 w-5 text-primary" />
        <h3 className="font-display font-bold text-base sm:text-lg text-foreground">Dúvidas frequentes</h3>
      </div>

      <Accordion type="single" collapsible className="space-y-1">
        {faqs.map((faq, i) => (
          <AccordionItem key={i} value={`faq-${i}`} className="border-border">
            <AccordionTrigger className="text-sm font-body font-medium text-foreground hover:no-underline text-left py-4 min-h-[48px]">
              {faq.q}
            </AccordionTrigger>
            <AccordionContent className="text-sm font-body text-muted-foreground leading-relaxed">
              {faq.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </motion.div>
  );
}
