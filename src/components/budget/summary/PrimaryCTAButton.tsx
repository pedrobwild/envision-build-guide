import { motion } from "framer-motion";
import { MessageCircle, FileCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface PrimaryCTAButtonProps {
  /** Budget validity expired */
  expired: boolean;
  /** Disabled state (e.g. already requested) */
  disabled?: boolean;
  /** Label override for contracted state */
  contractRequested?: boolean;
  /** WhatsApp link for expired budgets */
  whatsappUrl?: string;
  onClick?: () => void;
}

export function PrimaryCTAButton({
  expired,
  disabled,
  contractRequested,
  whatsappUrl,
  onClick,
}: PrimaryCTAButtonProps) {
  const baseClass = cn(
    "w-full min-h-[52px] rounded-xl font-display font-bold text-sm flex items-center justify-center gap-2 transition-all",
    "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
  );

  if (contractRequested) {
    return (
      <div
        className={cn(
          baseClass,
          "bg-muted/40 text-muted-foreground border border-border/60 cursor-default"
        )}
      >
        <FileCheck className="h-4 w-4 flex-shrink-0" aria-hidden />
        Contrato solicitado
      </div>
    );
  }

  if (expired) {
    return (
      <motion.a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        whileTap={{ scale: 0.97 }}
        className={cn(
          baseClass,
          "bg-primary text-primary-foreground shadow-md shadow-primary/15 active:shadow-sm"
        )}
      >
        <MessageCircle className="h-4 w-4 flex-shrink-0" aria-hidden />
        Solicitar atualização
      </motion.a>
    );
  }

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      className={cn(
        baseClass,
        disabled
          ? "bg-muted/40 text-muted-foreground cursor-not-allowed"
          : "bg-primary text-primary-foreground shadow-md shadow-primary/15 active:shadow-sm"
      )}
    >
      <MessageCircle className="h-4 w-4 flex-shrink-0" aria-hidden />
      Falar com comercial
    </motion.button>
  );
}
