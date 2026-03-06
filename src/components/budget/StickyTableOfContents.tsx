import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const tocItems = [
  { label: "Visão geral", id: "investment-impact" },
  { label: "Projeto", id: "arquitetonico-section" },
  { label: "Engenharia", id: "engenharia-section" },
  { label: "Portal Bwild", id: "portal-section" },
  { label: "Escopo da reforma", id: "floor-plan-section" },
  { label: "Segurança", id: "project-security" },
  { label: "Próximos passos", id: "next-steps" },
];

export function StickyTableOfContents() {
  const [activeId, setActiveId] = useState<string | null>(null);

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

    tocItems.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav
      className="hidden xl:block fixed left-4 top-1/2 -translate-y-1/2 z-40 w-[180px]"
      data-pdf-hide
    >
      <div className="bg-card/80 backdrop-blur-md rounded-lg border border-border p-3 space-y-1">
        {tocItems.map(({ label, id }) => (
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
    </nav>
  );
}
