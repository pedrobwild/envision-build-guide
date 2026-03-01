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
    q: "O que acontece após a aprovação do orçamento?",
    a: "Após a aprovação, nossa equipe entra em contato para alinhar o cronograma de execução, definir datas de início e assinatura do contrato.",
  },
  {
    q: "Os valores podem mudar depois da aprovação?",
    a: "Os valores são fixos dentro do prazo de validade. Alterações de escopo solicitadas pelo cliente podem gerar aditivos, sempre acordados previamente.",
  },
  {
    q: "Quais são as formas de pagamento?",
    a: "Trabalhamos com parcelamento por etapas de obra, transferência bancária, PIX e boleto. Condições especiais podem ser negociadas diretamente com a consultora.",
  },
  {
    q: "A reforma inclui garantia?",
    a: "Sim. Todos os serviços possuem garantia de 1 ano para mão de obra. Materiais seguem a garantia do fabricante.",
  },
  {
    q: "Quanto tempo dura a reforma?",
    a: "O prazo varia conforme a complexidade do projeto. Um cronograma detalhado é apresentado antes do início, com acompanhamento semanal de progresso.",
  },
];

export function BudgetFAQ() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="rounded-lg border border-border bg-card p-6"
    >
      <div className="flex items-center gap-2 mb-5">
        <HelpCircle className="h-5 w-5 text-primary" />
        <h3 className="font-display font-bold text-lg text-foreground">Perguntas Frequentes</h3>
      </div>

      <Accordion type="single" collapsible className="space-y-1">
        {faqs.map((faq, i) => (
          <AccordionItem key={i} value={`faq-${i}`} className="border-border">
            <AccordionTrigger className="text-sm font-body font-medium text-foreground hover:no-underline">
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
