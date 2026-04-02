import { useState, useRef, useEffect } from "react";
import { SectionSummaryRow } from "./SectionSummaryRow";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  AlertTriangle,
  Shield,
  CreditCard,
  MessageCircle,
  FileSignature,
  
  ChevronDown,
} from "lucide-react";
import { formatBRL, formatDateLong } from "@/lib/formatBRL";
import { cn } from "@/lib/utils";

import { ContractRequestDialog } from "./ContractRequestDialog";
import type { CategorizedGroup } from "@/lib/scope-categories";

interface MobileInlineSummaryProps {
  total: number;
  validity: {
    expired: boolean;
    daysLeft: number;
    expiresAt: Date;
  };
  categorizedGroups: CategorizedGroup[];
  projectName?: string;
  clientName?: string;
  publicId: string;
  budgetId?: string;
  onTotalCardVisibilityChange?: (visible: boolean) => void;
}

const DEFAULT_PHONE = "5511911906183";

export function MobileInlineSummary({
  total,
  validity,
  categorizedGroups,
  projectName,
  clientName,
  publicId,
  budgetId,
  onTotalCardVisibilityChange,
}: MobileInlineSummaryProps) {
  const [installments, setInstallments] = useState(10);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  const [contractOpen, setContractOpen] = useState(false);
  const totalCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!totalCardRef.current || !onTotalCardVisibilityChange) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        onTotalCardVisibilityChange(entry.isIntersecting);
      },
      { threshold: 0.5 }
    );

    observer.observe(totalCardRef.current);
    return () => observer.disconnect();
  }, [onTotalCardVisibilityChange]);

  const whatsappUpdateUrl = `https://wa.me/${DEFAULT_PHONE}?text=${encodeURIComponent(
    `Olá! O orçamento ${projectName || "do projeto"} (Ref: ${publicId}) expirou. Gostaria de solicitar uma atualização de valores.`
  )}`;

  return (
    <div
      id="resumo-mobile"
      className="lg:hidden scroll-mt-24"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-3.5"
      >
        <h2 className="text-lg font-display font-bold text-foreground tracking-tight">
          Resumo do investimento
        </h2>

        <div
          className={cn(
            "rounded-lg px-3 py-2.5 flex items-center gap-2",
            validity.expired
              ? "bg-destructive/8 border border-destructive/15"
              : validity.daysLeft <= 5
                ? "bg-warning/8 border border-warning/15"
                : "bg-success/8 border border-success/15"
          )}
        >
          {validity.expired ? (
            <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
          ) : (
            <Clock
              className={cn(
                "h-4 w-4 flex-shrink-0",
                validity.daysLeft <= 5 ? "text-warning" : "text-success"
              )}
            />
          )}
          <p
            className={cn(
              "text-xs font-body leading-snug",
              validity.expired ? "text-destructive" : "text-foreground"
            )}
          >
            {validity.expired
              ? "Condições expiradas — solicite valores atualizados."
              : `Condições válidas até ${formatDateLong(validity.expiresAt)}`}
          </p>
        </div>

        {categorizedGroups.length > 0 && (
          <div className="rounded-xl border border-border bg-card px-3 py-3 space-y-0.5">
            <p className="text-xs font-display font-semibold text-muted-foreground tracking-wider mb-2">
              Composição do investimento
            </p>
            {categorizedGroups.flatMap((group) =>
              group.sections.map((section) => {
                const subtotal = calculateSectionSubtotal(section);
                return (
                  <div
                    key={section.id}
                    className="w-full flex items-center gap-2.5 py-2.5 px-1.5 rounded-lg min-h-[44px]"
                  >
                    <div
                      className={cn(
                        "w-1 h-4 rounded-full flex-shrink-0",
                        group.category.bgClass
                      )}
                    />
                    <span className="flex-1 text-[13px] font-body text-foreground leading-snug text-left">
                      {section.title}
                    </span>
                    <span className="text-[13px] font-mono tabular-nums font-semibold text-foreground whitespace-nowrap">
                      {formatBRL(subtotal)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}

        <div
          ref={totalCardRef}
          className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/4 border border-primary/15 px-4 py-5 shadow-sm"
        >
          <p className="text-xs font-body font-medium text-muted-foreground mb-1">
            Investimento total
          </p>
          <p className="font-display font-extrabold text-2xl text-primary tabular-nums leading-none">
            {formatBRL(total)}
          </p>
          <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-primary/10">
            <Shield className="h-3 w-3 text-primary/40" />
            <span className="text-xs text-muted-foreground/80 font-body">
              Preço fixo · Sem custos ocultos
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card px-3 py-3">
          <div className="flex items-center gap-2 mb-2.5">
            <CreditCard className="h-3.5 w-3.5 text-primary" />
            <span className="text-[13px] font-display font-bold text-foreground">
              Simule o parcelamento
            </span>
          </div>

          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors min-h-[44px]"
          >
            <span className="text-[13px] font-body font-medium text-foreground">
              {installments}× {installments === 1 ? "parcela" : "parcelas"}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold tabular-nums text-primary">
                {formatBRL(total / installments)}
              </span>
              <ChevronDown className={cn(
                "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
                dropdownOpen && "rotate-180"
              )} />
            </div>
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="mt-1.5 max-h-[220px] overflow-y-auto rounded-lg border border-border/50 bg-muted/20 divide-y divide-border/30">
                  {Array.from({ length: 18 }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      onClick={() => { setInstallments(n); setDropdownOpen(false); }}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 text-[13px] font-body transition-colors min-h-[40px]",
                        installments === n
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-foreground hover:bg-muted/50"
                      )}
                    >
                      <span>{n}× {n === 1 ? "parcela" : "parcelas"}</span>
                      <span className="font-semibold tabular-nums">{formatBRL(total / n)}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-xs text-muted-foreground font-body mt-2.5 text-center">
            Condições sob consulta com sua consultora
          </p>
        </div>

        {/* Inline CTA */}
        {validity.expired ? (
          <motion.a
            href={whatsappUpdateUrl}
            target="_blank"
            rel="noopener noreferrer"
            whileTap={{ scale: 0.97 }}
            className="w-full min-h-[52px] rounded-xl bg-primary text-primary-foreground font-display font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-primary/20 active:shadow-sm transition-shadow"
          >
            <MessageCircle className="h-4 w-4 flex-shrink-0" />
            Solicitar atualização
          </motion.a>
        ) : (
          <motion.button
            onClick={() => setContractOpen(true)}
            whileTap={{ scale: 0.97 }}
            className="w-full min-h-[52px] rounded-xl bg-primary text-primary-foreground font-display font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-primary/20 active:shadow-sm transition-shadow"
          >
            <FileSignature className="h-4 w-4 flex-shrink-0" />
            Solicitar Contrato
          </motion.button>
        )}
      </motion.div>


      <ContractRequestDialog
        open={contractOpen}
        onOpenChange={setContractOpen}
        budgetId={budgetId || ""}
        publicId={publicId}
        projectName={projectName}
        total={total}
      />
    </div>
  );
}
