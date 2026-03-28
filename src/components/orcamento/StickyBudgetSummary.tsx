import { useState, useEffect } from "react";
import { CheckCircle2, FileSignature, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BudgetMeta } from "@/lib/orcamento-types";

interface StickyBudgetSummaryProps {
  meta: BudgetMeta;
  included: string[];
}

const sectionAnchors = [
  { label: "Resumo", id: "budget-hero" },
  { label: "Serviços", id: "services-section" },
  { label: "Jornada", id: "journey-section" },
  { label: "Escopo", id: "scope-section" },
  { label: "Garantia", id: "portal-section" },
];

export function StickyBudgetSummary({ meta, included }: StickyBudgetSummaryProps) {
  const [activeId, setActiveId] = useState<string>("budget-hero");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );

    sectionAnchors.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-4">
      {/* Meta */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="space-y-1 text-xs font-body text-muted-foreground">
          <p><span className="font-semibold text-foreground">Área:</span> {meta.area}</p>
          <p><span className="font-semibold text-foreground">Versão:</span> {meta.version}</p>
          <p><span className="font-semibold text-foreground">Validade:</span> {meta.validUntil}</p>
        </div>

        <div className="border-t border-border pt-3">
          <p className="text-xs font-display font-semibold text-foreground uppercase tracking-wider mb-2">
            Inclui
          </p>
          <ul className="space-y-1">
            {included.map((item) => (
              <li key={item} className="flex items-start gap-1.5 text-xs font-body text-foreground">
                <CheckCircle2 className="h-3 w-3 text-primary flex-shrink-0 mt-0.5" />
                <span className="leading-tight">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2 pt-2">
          <Button className="w-full gap-2" size="sm">
            <FileSignature className="h-3.5 w-3.5" />
            Solicitar Contrato
          </Button>
          <Button variant="outline" className="w-full gap-2" size="sm">
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp
          </Button>
        </div>
      </div>

      {/* Section progress */}
      <div className="rounded-lg border border-border bg-card p-3 space-y-1">
        <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          Navegação
        </p>
        {sectionAnchors.map(({ label, id }) => (
          <button
            key={id}
            onClick={() => scrollTo(id)}
            className={cn(
              "block w-full text-left text-xs font-body px-2 py-1.5 rounded transition-colors border-l-2",
              activeId === id
                ? "border-primary text-primary font-semibold bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
