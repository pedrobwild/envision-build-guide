import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { CheckCircle2, ZoomIn } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbox } from "@/components/budget/Lightbox";

type GalleryTab = "3d" | "exec";

const bullets = [
  "Reuniões de briefing e revisões com arquiteta",
  "Projeto 3D: layout, iluminação, marcenaria e decoração",
  "Projeto executivo + memorial descritivo",
  "ART e acompanhamento técnico durante a obra",
  "Aprovação no CREA e no condomínio (toda burocracia)",
];

const executiveDetails = [
  "Plantas detalhadas com dimensões exatas",
  "Projeto elétrico e hidráulico",
  "Especificações de materiais e acabamentos",
  "Detalhamento de marcenaria e mobiliário sob medida",
];

const tabs = [
  { id: "3d", label: "Projeto 3D" },
  { id: "exec", label: "Projeto Executivo" },
] as const;

const gallery = {
  "3d": [
    { src: "/images/exemplo-projeto-3d-1.jpg", alt: "Projeto 3D — Sala e cozinha" },
    { src: "/images/exemplo-projeto-3d-2.jpg", alt: "Projeto 3D — Dormitório e banheiro" },
  ],
  exec: [
    { src: "/images/exemplo-executivo-1.jpg", alt: "Projeto Executivo — Vistas modificações" },
    { src: "/images/exemplo-executivo-2.jpg", alt: "Projeto Executivo — Detalhamento banheiro" },
  ],
};

export function ArquitetonicoExpander() {
  const [activeTab, setActiveTab] = useState<"3d" | "exec">("3d");
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  return (
    <>
      <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5 overflow-hidden">
        <CardContent className="p-5 sm:p-6 space-y-5">
          <div>
            <h3 className="text-base sm:text-lg font-display font-bold text-foreground">
              Projeto Arquitetônico Personalizado
            </h3>
            <p className="text-sm text-muted-foreground font-body mt-1">
              Diferente de modelos padronizados, o projeto da Bwild é desenvolvido exclusivamente para sua unidade.
            </p>
          </div>

          <ul className="space-y-2.5">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm font-body text-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <div className="rounded-lg border-l-4 border-primary bg-primary/5 px-4 py-3">
            <p className="text-sm font-body text-foreground leading-relaxed">
              Você tem contato direto com a Lorena, sócia e diretora de arquitetura — projeto feito para sua unidade.
            </p>
          </div>

          {/* Gallery tabs */}
          <div className="space-y-3">
            <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wide">
              Exemplo de entrega real
            </p>
            <div className="flex gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-3 py-1.5 rounded-md text-xs font-display font-semibold transition-colors ${
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                {gallery[activeTab].map((img) => (
                  <button
                    key={img.src}
                    onClick={() => setLightboxSrc(img.src)}
                    className="group relative rounded-lg overflow-hidden border border-border bg-muted aspect-[16/10] focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <img
                      src={img.src}
                      alt={img.alt}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-charcoal/0 group-hover:bg-charcoal/30 transition-colors flex items-center justify-center">
                      <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                    </div>
                    <span className="absolute bottom-2 left-2 right-2 text-[10px] font-body text-white bg-charcoal/60 backdrop-blur-sm rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity truncate">
                      {img.alt}
                    </span>
                  </button>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>

          <Accordion type="single" collapsible>
            <AccordionItem value="exec" className="border-border">
              <AccordionTrigger className="hover:no-underline text-sm font-display font-semibold py-2">
                Saiba mais
              </AccordionTrigger>
              <AccordionContent className="space-y-3 text-sm font-body text-muted-foreground">
                <p className="font-display font-semibold text-foreground text-xs">
                  Projeto Executivo — o que acontece nesta etapa
                </p>
                <p>
                  Nossa equipe de engenharia desenvolve o conjunto completo de documentos técnicos para execução com precisão.
                </p>
                <ul className="space-y-1.5 pl-1">
                  {executiveDetails.map((d) => (
                    <li key={d} className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
                <div className="rounded-md bg-muted/50 px-3 py-2 mt-2">
                  <p className="text-xs text-muted-foreground italic">
                    Menos improviso, menos retrabalho, mais previsibilidade.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {lightboxSrc && (
        <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}
    </>
  );
}
