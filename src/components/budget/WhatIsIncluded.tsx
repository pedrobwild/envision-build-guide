import { motion } from "framer-motion";
import { Landmark, Ruler, ClipboardList, HardHat, Truck, Smartphone, SearchCheck, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const items = [
  { icon: Landmark, title: "Projeto arquitetônico personalizado", desc: "Desenvolvido exclusivamente para sua unidade, sem modelos prontos.", badge: "Exclusividade total" },
  { icon: Ruler, title: "Projeto executivo + memorial descritivo", desc: "Documentação técnica completa para execução sem improvisos.", badge: "Zero improvisos" },
  { icon: ClipboardList, title: "ART + burocracias (CREA e condomínio)", desc: "Cuidamos de toda aprovação técnica e documental.", badge: "Sem dor de cabeça" },
  { icon: HardHat, title: "Engenharia e gestão", desc: "Coordenação completa de fornecedores, materiais e cronograma.", badge: "Gestão profissional" },
  { icon: Truck, title: "Compras e logística", desc: "Aquisição e entrega de todos os materiais e equipamentos.", badge: "Tudo resolvido" },
  { icon: Smartphone, title: "Portal digital de acompanhamento", desc: "Acesso a documentos, pagamentos, fotos e evolução em tempo real.", badge: "Transparência total" },
  { icon: SearchCheck, title: "Entrega + vistoria final", desc: "Obra finalizada só após aprovação de todos os detalhes.", badge: "Qualidade garantida" },
  { icon: ShieldCheck, title: "Garantia de 5 anos", desc: "Certificado de garantia estrutural e canal de suporte pós-obra.", badge: "Tranquilidade" },
];

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
};

export function WhatIsIncluded() {
  return (
    <div className="space-y-5">
      <h2 className="text-lg sm:text-xl font-display font-bold text-foreground">
        O que está incluso neste projeto Bwild
      </h2>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-40px" }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        {items.map((item) => (
          <motion.div
            key={item.title}
            variants={itemVariants}
            className="rounded-xl border border-border bg-card p-5 space-y-3 hover:border-primary/30 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1 min-w-0">
                <p className="font-display font-semibold text-sm text-foreground leading-snug">{item.title}</p>
                <p className="text-xs text-muted-foreground font-body leading-relaxed">{item.desc}</p>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs font-body">
              Por que isso importa: {item.badge}
            </Badge>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
