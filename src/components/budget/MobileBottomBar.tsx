import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  FileSignature,
  MessageCircle,
  Shield,
  Award,
  CheckCircle2,
} from "lucide-react";
import { formatBRL } from "@/lib/formatBRL";
import type { CategorizedGroup } from "@/lib/scope-categories";
import { ContractRequestDialog } from "./ContractRequestDialog";

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
}

const DEFAULT_PHONE = "5511911906183";

export function MobileBottomBar({
  total,
  validity,
  projectName,
  clientName,
  publicId,
  budgetId,
  hidden = false,
}: MobileBottomBarProps) {
  const [contractOpen, setContractOpen] = useState(false);

  const whatsappUpdateUrl = `https://wa.me/${DEFAULT_PHONE}?text=${encodeURIComponent(
    `Olá! O orçamento ${projectName || "do projeto"} (Ref: ${publicId}) expirou. Gostaria de solicitar uma atualização de valores.`
  )}`;

  const scrollToSummary = () => {
    document.getElementById("resumo-mobile")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
              {/* Trust micro-line */}
              <div className="flex items-center justify-center gap-3 px-4 py-1 bg-muted/20">
                <span className="flex items-center gap-1 text-xs text-muted-foreground font-body">
                  <Shield className="h-3 w-3" aria-hidden="true" />
                  Preço fixo
                </span>
                <span className="text-muted-foreground/20" aria-hidden="true">·</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground font-body">
                  <Award className="h-3 w-3" aria-hidden="true" />
                  Garantia 5 anos
                </span>
                <span className="text-muted-foreground/20" aria-hidden="true">·</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground font-body">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  Sem custos ocultos
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))]">
                {/* Left: total + scroll trigger */}
                <button
                  onClick={scrollToSummary}
                  className="flex flex-col min-h-[44px] justify-center"
                >
                  <span className="font-display font-bold text-foreground text-base tabular-nums">
                    {formatBRL(total)}
                  </span>
                  <span className="text-xs text-muted-foreground font-body flex items-center gap-1">
                    <ChevronDown className="h-3 w-3" aria-hidden="true" />
                    Ver resumo ↓
                  </span>
                </button>

                {/* Right: CTA */}
                {validity.expired ? (
                  <motion.a
                    href={whatsappUpdateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileTap={{ scale: 0.97 }}
                    className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-display font-bold text-sm min-h-[48px] flex items-center gap-2 whitespace-nowrap shadow-md shadow-primary/20 active:shadow-sm transition-shadow"
                  >
                    <MessageCircle className="h-4 w-4 flex-shrink-0" />
                    Solicitar atualização
                  </motion.a>
                ) : (
                  <motion.button
                    onClick={() => setContractOpen(true)}
                    whileTap={{ scale: 0.97 }}
                    className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-display font-bold text-sm min-h-[48px] flex items-center gap-2 whitespace-nowrap shadow-md shadow-primary/20 active:shadow-sm transition-shadow"
                  >
                    <FileSignature className="h-4 w-4 flex-shrink-0" />
                    Solicitar Contrato
                  </motion.button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
