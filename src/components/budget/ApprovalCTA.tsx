import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, PartyPopper, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ApprovalCTAProps {
  budgetId: string;
  publicId: string;
  approvedAt?: string | null;
  approvedByName?: string | null;
  expired?: boolean;
  projectName?: string;
}

export function ApprovalCTA({ budgetId, publicId, approvedAt, approvedByName }: ApprovalCTAProps) {
  const [step, setStep] = useState<"idle" | "form" | "loading" | "done">(approvedAt ? "done" : "idle");
  const [name, setName] = useState(approvedByName || "");

  const handleApprove = async () => {
    if (!name.trim()) {
      toast.error("Por favor, informe seu nome.");
      return;
    }
    setStep("loading");
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      await fetch(`${supabaseUrl}/rest/v1/budgets?public_id=eq.${publicId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          approved_at: new Date().toISOString(),
          approved_by_name: name.trim(),
        }),
      });
      setStep("done");
      toast.success("Orçamento aprovado com sucesso!");
    } catch {
      toast.error("Erro ao aprovar. Tente novamente.");
      setStep("form");
    }
  };

  if (step === "done") {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="rounded-lg border-2 border-success/30 bg-success/10 p-5 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
        >
          <PartyPopper className="h-8 w-8 text-success mx-auto mb-2" />
        </motion.div>
        <p className="font-display font-bold text-foreground">Orçamento Aprovado!</p>
        {(approvedByName || name) && (
          <p className="text-sm text-muted-foreground mt-1">
            Aprovado por {approvedByName || name}
          </p>
        )}
      </motion.div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <AnimatePresence mode="wait">
        {step === "idle" && (
          <motion.div key="idle" exit={{ opacity: 0 }} className="text-center space-y-3">
            <p className="font-display font-semibold text-foreground">Pronto para iniciar seu projeto?</p>
            <p className="text-sm text-muted-foreground font-body">
              Após iniciar, agendamos seu briefing com a Lorena e começamos seu Projeto 3D.
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setStep("form")}
              className="w-full py-3 rounded-lg bg-success text-success-foreground font-display font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="h-5 w-5" />
              Iniciar meu projeto
            </motion.button>
            <a
              href="https://wa.me/5511999999999?text=Olá, gostaria de tirar dúvidas sobre meu orçamento."
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 rounded-lg border border-border text-foreground font-display font-semibold text-sm hover:bg-muted/50 transition-colors flex items-center justify-center gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              Falar com especialista
            </a>
            <p className="text-xs text-muted-foreground font-body">
              Sem compromisso — tire dúvidas com nosso time.
            </p>
          </motion.div>
        )}

        {(step === "form" || step === "loading") && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <p className="font-display font-semibold text-foreground text-center">Confirme sua aprovação</p>
            <input
              type="text"
              placeholder="Seu nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-success/30 font-body text-sm"
              disabled={step === "loading"}
            />
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleApprove}
              disabled={step === "loading"}
              className="w-full py-3 rounded-lg bg-success text-success-foreground font-display font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {step === "loading" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
              {step === "loading" ? "Aprovando..." : "Confirmar e iniciar projeto"}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
