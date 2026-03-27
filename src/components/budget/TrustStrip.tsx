import { motion } from "framer-motion";
import { Shield, Clock, Award, Users, FileCheck, Headphones } from "lucide-react";
import { cn } from "@/lib/utils";
import seloReclameAqui from "@/assets/selo-reclame-aqui.png";

interface TrustStripProps {
  prazoDiasUteis?: number;
}

const signals = [
  { icon: Shield, label: "Preço fixo", sublabel: "sem surpresas" },
  { icon: Award, label: "Garantia 5 anos", sublabel: "estrutural" },
  { icon: FileCheck, label: "ART registrada", sublabel: "no CREA" },
  { icon: Users, label: "Equipe própria", sublabel: "gestão direta" },
  { icon: Headphones, label: "Suporte pós-obra", sublabel: "canal direto" },
];

export function TrustStrip({ prazoDiasUteis = 55 }: TrustStripProps) {
  return (
    <div className="lg:hidden space-y-3">
      {/* Horizontal scroll chips */}
      <div
        className="flex gap-2 overflow-x-auto scrollbar-none px-1 pb-1 snap-x snap-mandatory"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {/* Prazo chip — highlighted */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/8 border border-primary/12 snap-start"
        >
          <Clock className="h-4 w-4 text-primary" />
          <div className="flex flex-col">
            <span className="text-sm font-display font-bold text-primary tabular-nums leading-none">
              {prazoDiasUteis} dias úteis
            </span>
            <span className="text-[10px] text-muted-foreground font-body leading-none mt-0.5">
              prazo de execução
            </span>
          </div>
        </motion.div>

        {signals.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, x: 8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.04 }}
            className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40 border border-border snap-start"
          >
            <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-xs font-display font-semibold text-foreground leading-none">
                {s.label}
              </span>
              <span className="text-[10px] text-muted-foreground font-body leading-none mt-0.5">
                {s.sublabel}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ReclameAqui seal — compact */}
      <motion.a
        href="https://www.reclameaqui.com.br/empresa/bwild-reformas/sobre/#info-rav"
        target="_blank"
        rel="noopener noreferrer"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-success/5 border border-success/10 w-fit"
      >
        <img
          src={seloReclameAqui}
          alt="Selo RA Verificada"
          className="h-5 w-5 object-contain"
        />
        <span className="text-xs font-body text-success font-medium">
          0 reclamações há 6 meses
        </span>
      </motion.a>
    </div>
  );
}
