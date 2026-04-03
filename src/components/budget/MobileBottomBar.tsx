import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronUp,
  FileSignature,
  MessageCircle,
  Shield,
  Award,
  CheckCircle2,
  Eye,
  CreditCard,
} from "lucide-react";
import { formatBRL } from "@/lib/formatBRL";
import type { CategorizedGroup } from "@/lib/scope-categories";
import { MobileFinancialSheet } from "./MobileFinancialSheet";
import { StepProgressIndicator } from "./StepProgressIndicator";
import { WhatsAppCommentDialog } from "./WhatsAppCommentDialog";

interface MobileBottomBarProps {
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
  onSaveForLater?: () => void;
  hidden?: boolean;
  activeSection?: string | null;
}

const DEFAULT_PHONE = "5511911906183";

type CtaVariant = {
  label: string;
  icon: React.ElementType;
  action: "scroll" | "sheet" | "whatsapp";
  scrollTarget?: string;
};

const CTA_MAP: Record<string, CtaVariant> = {
  "mobile-included": {
    label: "Ver escopo",
    icon: Eye,
    action: "scroll",
    scrollTarget: "mobile-scope",
  },
  "mobile-scope": {
    label: "Simular parcelas",
    icon: CreditCard,
    action: "sheet",
  },
  "mobile-trust": {
    label: "Simular parcelas",
    icon: CreditCard,
    action: "sheet",
  },
  "mobile-portal": {
    label: "Falar com comercial",
    icon: MessageCircle,
    action: "whatsapp",
  },
  "mobile-next-steps": {
    label: "Falar com comercial",
    icon: MessageCircle,
    action: "whatsapp",
  },
  "mobile-faq": {
    label: "Falar com comercial",
    icon: MessageCircle,
    action: "whatsapp",
  },
};

const DEFAULT_CTA: CtaVariant = {
  label: "Falar com comercial",
  icon: MessageCircle,
  action: "whatsapp",
};

export function MobileBottomBar({
  total,
  validity,
  categorizedGroups,
  projectName,
  clientName,
  publicId,
  budgetId,
  hidden = false,
  activeSection,
}: MobileBottomBarProps) {
  const [contractOpen, setContractOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const whatsappUpdateUrl = `https://wa.me/${DEFAULT_PHONE}?text=${encodeURIComponent(
    `Olá! O orçamento ${projectName || "do projeto"} (Ref: ${publicId}) expirou. Gostaria de solicitar uma atualização de valores.`
  )}`;

  const currentCta = useMemo(() => {
    if (!activeSection) return DEFAULT_CTA;
    return CTA_MAP[activeSection] || DEFAULT_CTA;
  }, [activeSection]);

  const handleCtaClick = () => {
    switch (currentCta.action) {
      case "scroll":
        if (currentCta.scrollTarget) {
          document.getElementById(currentCta.scrollTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        break;
      case "sheet":
        setSheetOpen(true);
        break;
      case "contract":
        setContractOpen(true);
        break;
    }
  };

  const CtaIcon = currentCta.icon;

  return (
    <>
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 pointer-events-none" data-pdf-hide>
        <AnimatePresence>
          {!hidden && (
            <motion.div
              initial={{ y: 0 }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto bg-card/80 backdrop-blur-xl border-t border-border/60 shadow-[0_-4px_20px_-4px_hsl(var(--foreground)/0.06)]"
            >
              {/* Trust micro-line + step indicator */}
              <div className="flex items-center justify-center gap-3 px-4 py-1 bg-muted/20" role="status" aria-label="Garantias do orçamento">
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground/90 font-body">
                  <Shield className="h-3 w-3" aria-hidden="true" />
                  Preço fixo
                </span>
                <span className="text-muted-foreground/20" aria-hidden="true">·</span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground/90 font-body">
                  <Award className="h-3 w-3" aria-hidden="true" />
                  Garantia 5 anos
                </span>
                <span className="text-muted-foreground/20" aria-hidden="true">·</span>
                <StepProgressIndicator
                  sectionIds={["mobile-included", "mobile-scope", "mobile-trust", "mobile-portal", "mobile-next-steps", "mobile-faq"]}
                />
              </div>
              <div className="flex items-center justify-between px-4 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))]">
                {/* Left: total + sheet trigger */}
                <button
                  onClick={() => {
                    if (navigator.vibrate) navigator.vibrate(10);
                    setSheetOpen(true);
                  }}
                  className="flex flex-col min-h-[44px] justify-center"
                  aria-label="Ver resumo financeiro"
                >
                  <span className="font-display font-bold text-foreground text-base tabular-nums">
                    {formatBRL(total)}
                  </span>
                  <span className="text-xs text-muted-foreground font-body flex items-center gap-1">
                    <ChevronUp className="h-3 w-3" aria-hidden="true" />
                    Ver resumo
                  </span>
                </button>

                {/* Right: Dynamic CTA */}
                {validity.expired ? (
                  <motion.a
                    href={whatsappUpdateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileTap={{ scale: 0.97 }}
                    className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-display font-bold text-sm min-h-[48px] flex items-center gap-2 whitespace-nowrap shadow-md shadow-primary/20 active:shadow-sm transition-shadow"
                  >
                    <MessageCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                    Solicitar atualização
                  </motion.a>
                ) : (
                  <AnimatePresence mode="wait">
                  <motion.button
                      key={currentCta.label}
                      onClick={() => {
                        // Haptic feedback
                        if (navigator.vibrate) navigator.vibrate(10);
                        handleCtaClick();
                      }}
                      whileTap={{ scale: 0.97 }}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-display font-bold text-sm min-h-[48px] flex items-center gap-2 whitespace-nowrap shadow-md shadow-primary/20 active:shadow-sm transition-shadow"
                    >
                      <CtaIcon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                      {currentCta.label}
                    </motion.button>
                  </AnimatePresence>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Financial Summary Sheet */}
      <MobileFinancialSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        total={total}
        validity={validity}
        categorizedGroups={categorizedGroups}
        projectName={projectName}
        clientName={clientName}
        publicId={publicId}
        budgetId={budgetId}
      />

      {/* Contract Request Dialog */}
      <ContractRequestDialog
        open={contractOpen}
        onOpenChange={setContractOpen}
        budgetId={budgetId || ""}
        publicId={publicId}
        projectName={projectName}
        total={total}
      />
    </>
  );
}
