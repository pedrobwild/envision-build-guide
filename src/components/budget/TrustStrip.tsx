import { useRef, useState, useEffect } from "react";
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const check = () => {
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
    };

    check();
    el.addEventListener("scroll", check, { passive: true });
    return () => el.removeEventListener("scroll", check);
  }, []);

  return (
    <div className="lg:hidden space-y-3">
      {/* Horizontal scroll chips with fade indicator */}
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto scrollbar-none px-1 pb-1 snap-x snap-mandatory"
          style={{ WebkitOverflowScrolling: "touch" }}
          role="list"
          aria-label="Garantias e diferenciais"
        >
          {signals.map((s, i) => (
            <motion.div
              key={s.label}
              role="listitem"
              initial={{ opacity: 0, x: 8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40 border border-border snap-start"
            >
              <s.icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <div className="flex flex-col">
                <span className="text-xs font-display font-semibold text-foreground leading-none">
                  {s.label}
                </span>
                <span className="text-xs text-muted-foreground font-body leading-none mt-0.5">
                  {s.sublabel}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Fade-out gradient — right edge scroll hint */}
        <div
          className={cn(
            "absolute right-0 top-0 bottom-1 w-10 pointer-events-none transition-opacity duration-300 bg-gradient-to-l from-background to-transparent",
            canScrollRight ? "opacity-100" : "opacity-0"
          )}
          aria-hidden="true"
        />
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
          width={20}
          height={20}
          className="h-5 w-5 object-contain"
        />
        <span className="text-xs font-body text-success font-medium">
          0 reclamações há 6 meses
        </span>
      </motion.a>
    </div>
  );
}
