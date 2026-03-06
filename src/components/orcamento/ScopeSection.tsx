import { useState, useMemo } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, List, AlignJustify } from "lucide-react";
import type { ScopeCategory } from "@/lib/orcamento-types";

interface ScopeSectionProps {
  scope: ScopeCategory[];
}

function highlightText(text: string, query: string) {
  if (!query) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-primary/20 text-foreground rounded-sm px-0.5">{part}</mark>
    ) : (
      part
    )
  );
}

export function ScopeSection({ scope }: ScopeSectionProps) {
  const [search, setSearch] = useState("");
  const [detailed, setDetailed] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return scope;
    const q = search.toLowerCase();
    return scope
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) =>
            item.title.toLowerCase().includes(q) ||
            item.summary.toLowerCase().includes(q) ||
            item.bullets.some((b) => b.toLowerCase().includes(q))
        ),
      }))
      .filter((cat) => cat.items.length > 0 || cat.title.toLowerCase().includes(q));
  }, [scope, search]);

  const matchedCategoryIds = useMemo(() => {
    if (!search.trim()) return [];
    return filtered.map((c) => c.id);
  }, [filtered, search]);

  return (
    <section className="space-y-4">
      <h2 className="text-lg sm:text-xl font-display font-bold text-foreground">
        Escopo da reforma
      </h2>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar seção ou item…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="flex rounded-md border border-border overflow-hidden self-start">
          <Button
            variant={!detailed ? "default" : "ghost"}
            size="sm"
            className="rounded-none h-9 text-xs gap-1.5"
            onClick={() => setDetailed(false)}
          >
            <List className="h-3.5 w-3.5" />
            Compacto
          </Button>
          <Button
            variant={detailed ? "default" : "ghost"}
            size="sm"
            className="rounded-none h-9 text-xs gap-1.5"
            onClick={() => setDetailed(true)}
          >
            <AlignJustify className="h-3.5 w-3.5" />
            Detalhado
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground font-body py-6 text-center">
          Nenhum item encontrado para "{search}".
        </p>
      ) : (
        <Accordion
          type="multiple"
          defaultValue={matchedCategoryIds}
          key={search}
        >
          {filtered.map((cat) => (
            <AccordionItem key={cat.id} value={cat.id} className="border-border">
              <AccordionTrigger className="hover:no-underline py-3">
                <span className="text-sm font-display font-semibold text-foreground">
                  {highlightText(cat.title, search)}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pl-1">
                  {cat.items.map((item) => (
                    <div key={item.title}>
                      <p className="text-sm font-body font-medium text-foreground">
                        {highlightText(item.title, search)}
                      </p>
                      <p className="text-xs text-muted-foreground font-body">
                        {highlightText(item.summary, search)}
                      </p>
                      {detailed && (
                        <ul className="mt-1.5 space-y-1 pl-4">
                          {item.bullets.map((b) => (
                            <li key={b} className="text-xs font-body text-muted-foreground list-disc">
                              {highlightText(b, search)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </section>
  );
}
