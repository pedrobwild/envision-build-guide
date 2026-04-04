import { motion } from "framer-motion";
import { MessageCircle, Shield, CheckCircle2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineCTAProps {
  publicId: string;
  projectName?: string;
  clientName?: string;
  expired?: boolean;
  /** Visual variant */
  variant?: "subtle" | "strong";
}

const DEFAULT_PHONE = "5511911906183";

export function InlineCTA({
  publicId,
  projectName,
  clientName,
  expired,
  variant = "subtle",
}: InlineCTAProps) {
  const whatsappMessage = expired
    ? encodeURIComponent(
        `Olá! O orçamento ${projectName || "do projeto"} (Ref: ${publicId}) expirou. Gostaria de solicitar uma atualização de valores.`
      )
    : encodeURIComponent(
        `Olá! Sou ${clientName || "cliente"}, estou analisando o orçamento do projeto ${projectName || "do projeto"} (Ref: ${publicId}) e gostaria de iniciar o projeto.`
      );
  const url = `https://wa.me/${DEFAULT_PHONE}?text=${whatsappMessage}`;

  const ctaLabel = expired ? "Solicitar atualização" : "Iniciar meu projeto";
  const isStrong = variant === "strong";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      className={cn(
        "lg:hidden rounded-2xl p-4 space-y-3",
        isStrong
          ? "bg-gradient-to-br from-primary/[0.08] to-primary/[0.03] border border-primary/[0.12]"
          : "bg-muted/30 border border-border"
      )}
    >
      {/* Trust line */}
      {!expired && (
        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-primary/50" />
            <span className="text-xs text-muted-foreground font-body">Preço fixo</span>
          </div>
          <span className="text-muted-foreground/30">·</span>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary/50" />
            <span className="text-xs text-muted-foreground font-body">Garantia 5 anos</span>
          </div>
        </div>
      )}

      {/* Contextual copy */}
      <p className="text-center text-sm font-body text-muted-foreground leading-snug">
        {isStrong
          ? "Pronto para avançar? Converse com nossa equipe, sem compromisso."
          : "Alguma dúvida? Estamos à disposição."}
      </p>

      {/* CTA button */}
      <motion.a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        whileTap={{ scale: 0.98 }}
        className={cn(
          "w-full min-h-[48px] rounded-xl font-display font-semibold text-sm flex items-center justify-center gap-2 whitespace-nowrap",
          isStrong
            ? "bg-primary text-primary-foreground"
            : "bg-card border border-primary/20 text-primary hover:bg-primary/5 transition-colors"
        )}
      >
        {isStrong ? (
          <MessageCircle className="h-4 w-4 flex-shrink-0" />
        ) : (
          <ArrowRight className="h-4 w-4 flex-shrink-0" />
        )}
        {ctaLabel}
      </motion.a>
    </motion.div>
  );
}
