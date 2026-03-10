import { useState, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { CheckCircle2, ZoomIn, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbox } from "@/components/budget/Lightbox";
import useEmblaCarousel from "embla-carousel-react";

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
    { src: "/images/exemplo-projeto-3d-1.png", alt: "Projeto 3D — Planta humanizada" },
    { src: "/images/exemplo-projeto-3d-2.png", alt: "Projeto 3D — Sala e cozinha" },
  ],
  exec: [
    { src: "/images/exemplo-executivo-1.jpg", alt: "Projeto Executivo — Vistas modificações" },
    { src: "/images/exemplo-executivo-2.jpg", alt: "Projeto Executivo — Detalhamento banheiro" },
  ],
};

export function ArquitetonicoExpander() {
  const [activeTab, setActiveTab] = useState<GalleryTab>("3d");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "center" });
  const [currentSlide, setCurrentSlide] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCurrentSlide(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  // Re-attach listener when tab or api changes
  useState(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    onSelect();
    return () => { emblaApi.off("select", onSelect); };
  });

  // Reset carousel when tab changes
  const handleTabChange = (tab: GalleryTab) => {
    setActiveTab(tab);
    setCurrentSlide(0);
    setTimeout(() => emblaApi?.scrollTo(0, true), 50);
  };

  const images = gallery[activeTab];

  return (
    <>
      <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5 overflow-hidden">
        <CardContent className="p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-5">
          <div>
            <h3 className="text-base sm:text-lg font-display font-bold text-foreground">
              Projeto Arquitetônico Personalizado
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground font-body mt-1">
              Diferente de modelos padronizados, o projeto da Bwild é desenvolvido exclusivamente para sua unidade.
            </p>
          </div>

          <ul className="space-y-2 sm:space-y-2.5">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2 sm:gap-2.5 text-xs sm:text-sm font-body text-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <div className="rounded-lg border-l-4 border-primary bg-primary/5 px-3 sm:px-4 py-2.5 sm:py-3">
            <p className="text-xs sm:text-sm font-body text-foreground leading-relaxed">
              Você tem contato direto com a Lorena, sócia e diretora de arquitetura — projeto feito para sua unidade.
            </p>
          </div>

          {/* Gallery tabs */}
          <div className="space-y-3">
            <p className="text-[10px] sm:text-xs font-display font-semibold text-muted-foreground uppercase tracking-wide">
              Exemplo de entrega real
            </p>
            <div className="flex gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
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
                className="relative"
              >
                {/* Carousel */}
                <div ref={emblaRef} className="overflow-hidden rounded-lg">
                  <div className="flex">
                    {images.map((img, idx) => (
                      <div key={img.src} className="min-w-0 shrink-0 grow-0 basis-full">
                        <button
                          onClick={() => {
                            setLightboxIndex(idx);
                            setLightboxOpen(true);
                          }}
                          className="group relative w-full rounded-lg overflow-hidden border border-border bg-muted aspect-[16/10] focus:outline-none focus:ring-2 focus:ring-primary active:scale-[0.98] transition-transform"
                        >
                          <img
                            src={img.src}
                            alt={img.alt}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-colors flex items-center justify-center">
                            <ZoomIn className="h-5 w-5 sm:h-6 sm:w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                          </div>
                          <span className="absolute bottom-1.5 left-1.5 right-1.5 text-[9px] sm:text-[10px] font-body text-white bg-foreground/60 backdrop-blur-sm rounded px-2 py-0.5 sm:py-1 opacity-0 group-hover:opacity-100 transition-opacity truncate">
                            {img.alt}
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Nav arrows */}
                {images.length > 1 && (
                  <>
                    <button
                      onClick={() => emblaApi?.scrollPrev()}
                      className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-card/80 backdrop-blur-sm border border-border shadow-sm hover:bg-card transition-colors"
                      aria-label="Anterior"
                    >
                      <ChevronLeft className="h-4 w-4 text-foreground" />
                    </button>
                    <button
                      onClick={() => emblaApi?.scrollNext()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-card/80 backdrop-blur-sm border border-border shadow-sm hover:bg-card transition-colors"
                      aria-label="Próxima"
                    >
                      <ChevronRight className="h-4 w-4 text-foreground" />
                    </button>
                  </>
                )}

                {/* Dots */}
                {images.length > 1 && (
                  <div className="flex justify-center gap-1.5 mt-2">
                    {images.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => emblaApi?.scrollTo(idx)}
                        className={`h-1.5 rounded-full transition-all ${
                          idx === currentSlide
                            ? "w-4 bg-primary"
                            : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                        }`}
                        aria-label={`Slide ${idx + 1}`}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <Accordion type="single" collapsible>
            <AccordionItem value="exec" className="border-border">
              <AccordionTrigger className="hover:no-underline text-xs sm:text-sm font-display font-semibold py-2">
                Saiba mais
              </AccordionTrigger>
              <AccordionContent className="space-y-3 text-xs sm:text-sm font-body text-muted-foreground">
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

      <Lightbox
        images={images.map((img) => ({ url: img.src, alt: img.alt }))}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}
