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
  {
    custom: true as const,
    label: "0 reclamações",
    sublabel: "há 6 meses",
  },
];

// `prazoDiasUteis` recebido apenas para compat futura — o badge atual de "Prazo" é exibido
// pelo BudgetHeader/MobileHeroCard com o valor real (sem fallback). Não usamos default aqui
// para garantir que ausência de prazo NUNCA seja mascarada por um número fictício.
export function TrustStrip(_props: TrustStripProps) {
  return (
    <div className="lg:hidden">
      {/* 3×2 grid — all visible at once, no scroll */}
      <div
        className="grid grid-cols-3 gap-2"
        role="list"
        aria-label="Garantias e diferenciais"
      >
        {signals.map((s, i) => (
          <motion.div
            key={s.label}
            role="listitem"
            initial={{ opacity: 0, y: 6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.04 }}
            className={cn(
              "flex flex-col items-center justify-center text-center gap-1.5 px-2 py-3 rounded-xl border",
              "custom" in s
                ? "bg-success/5 border-success/10"
                : "bg-muted/40 border-border"
            )}
          >
            {"custom" in s ? (
              <a
                href="https://www.reclameaqui.com.br/empresa/bwild-reformas/sobre/#info-rav"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5"
              >
                <img
                  src={seloReclameAqui}
                  alt="Selo RA Verificada"
                  width={18}
                  height={18}
                  className="h-[18px] w-[18px] object-contain"
                />
                <div className="flex flex-col">
                  <span className="text-[11px] font-body font-semibold text-success leading-tight">
                    {s.label}
                  </span>
                  <span className="text-[10px] text-success/70 font-body leading-tight mt-0.5">
                    {s.sublabel}
                  </span>
                </div>
              </a>
            ) : (
              <>
                {"icon" in s && (s as { icon?: React.ElementType }).icon && (() => {
                  const Icon = (s as { icon: React.ElementType }).icon;
                  return <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
                })()}
                <div className="flex flex-col">
                  <span className="text-[11px] font-body font-semibold text-foreground leading-tight">
                    {s.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-body leading-tight mt-0.5">
                    {s.sublabel}
                  </span>
                </div>
              </>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
