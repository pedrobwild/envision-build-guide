import { useState, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send } from "lucide-react";
import { getPublicBudgetUrl } from "@/lib/getPublicUrl";

interface WhatsAppCommentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName?: string;
  publicId: string;
  phone?: string;
}

const DEFAULT_PHONE = "5511911906183";

export const WhatsAppCommentDialog = forwardRef<HTMLDivElement, WhatsAppCommentDialogProps>(function WhatsAppCommentDialog({
  open,
  onOpenChange,
  projectName,
  publicId,
  phone = DEFAULT_PHONE,
}, _ref) {
  const [comment, setComment] = useState("");

  const buildWhatsAppUrl = () => {
    const budgetUrl = getPublicBudgetUrl(publicId);
    const parts = [
      `Olá! Estou analisando o orçamento "${projectName || "do projeto"}" e gostaria de comentar:`,
      "",
      comment.trim() || "(sem comentário)",
      "",
      `🔗 ${budgetUrl}`,
    ];
    return `https://wa.me/${phone}?text=${encodeURIComponent(parts.join("\n"))}`;
  };

  const handleSend = () => {
    window.open(buildWhatsAppUrl(), "_blank", "noopener,noreferrer");
    onOpenChange(false);
    setComment("");
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />

          {/* Dialog - anchored above the bottom bar */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-[calc(7rem+env(safe-area-inset-bottom,0px))] left-3 right-3 z-[61] rounded-2xl bg-card border border-border shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h3 className="font-display font-bold text-foreground text-[15px]">
                Comentários
              </h3>
              <button
                onClick={() => onOpenChange(false)}
                className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
                aria-label="Fechar"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Instruction */}
            <p className="px-4 text-xs text-muted-foreground font-body mb-3">
              Solicite revisão e tire suas dúvidas.
            </p>

            {/* Textarea */}
            <div className="px-4 pb-4">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Ex: Gostaria de entender melhor os prazos..."
                rows={3}
                className="w-full rounded-xl border border-border bg-muted/30 px-3.5 py-3 text-sm font-body text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
                autoFocus
              />

              {/* Send button */}
              <motion.button
                onClick={handleSend}
                whileTap={{ scale: 0.97 }}
                className="mt-3 w-full min-h-[48px] rounded-xl bg-[#25D366] text-white font-display font-bold text-sm flex items-center justify-center gap-2 shadow-md active:shadow-sm transition-shadow"
              >
                <MessageCircle className="h-4 w-4 flex-shrink-0" />
                Enviar via WhatsApp
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});
