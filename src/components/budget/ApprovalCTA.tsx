import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, PartyPopper, MessageCircle, AlertTriangle, Bookmark } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ApprovalCTAProps {
  budgetId: string;
  publicId: string;
  approvedAt?: string | null;
  approvedByName?: string | null;
  expired?: boolean;
  projectName?: string;
}

const DEFAULT_PHONE = "5511999999999";

export function ApprovalCTA({ budgetId, publicId, approvedAt, approvedByName, expired, projectName }: ApprovalCTAProps) {
  const [step, setStep] = useState<"idle" | "form" | "loading" | "done">(approvedAt ? "done" : "idle");
  const [name, setName] = useState(approvedByName || "");

  // Save-for-later dialog state
  const [saveOpen, setSaveOpen] = useState(false);
  const [leadEmail, setLeadEmail] = useState("");
  const [leadName, setLeadName] = useState("");
  const [saving, setSaving] = useState(false);

  const whatsappUpdateUrl = `https://wa.me/${DEFAULT_PHONE}?text=${encodeURIComponent(
    `Olá! O orçamento ${projectName || 'do projeto'} (Ref: ${publicId}) expirou. Gostaria de solicitar uma atualização de valores.`
  )}`;

  const whatsappDoubtUrl = `https://wa.me/${DEFAULT_PHONE}?text=${encodeURIComponent(
    `Olá! Estou analisando o orçamento do projeto *${projectName || 'do projeto'}* (Ref: ${publicId}) e gostaria de tirar uma dúvida sobre...`
  )}`;

  if (expired && !approvedAt) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-5 text-center space-y-3">
        <AlertTriangle className="h-6 w-6 text-destructive mx-auto" />
        <p className="font-display font-semibold text-foreground text-sm">Orçamento expirado</p>
        <p className="text-xs text-muted-foreground font-body">
          Os valores e condições desta proposta não estão mais vigentes. Solicite uma atualização.
        </p>
        <a
          href={whatsappUpdateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-display font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <MessageCircle className="h-4 w-4" />
          Solicitar atualização
        </a>
      </div>
    );
  }

  const handleApprove = async () => {
    if (!name.trim()) {
      toast.error("Por favor, informe seu nome.");
      return;
    }
    setStep("loading");
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      await fetch(`${supabaseUrl}/rest/v1/budgets?public_id=eq.${encodeURIComponent(publicId)}`, {
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

  const handleSaveLead = async () => {
    if (!leadEmail.trim() || !leadName.trim()) {
      toast.error("Preencha nome e email.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(leadEmail.trim())) {
      toast.error("Email inválido.");
      return;
    }
    setSaving(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      await fetch(`${supabaseUrl}/rest/v1/budgets?public_id=eq.${encodeURIComponent(publicId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          lead_email: leadEmail.trim().substring(0, 255),
          lead_name: leadName.trim().substring(0, 100),
        }),
      });
      toast.success("Pronto! Você pode acessar este orçamento a qualquer momento pelo link.");
      setSaveOpen(false);
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    }
    setSaving(false);
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
    <>
      <div className="rounded-lg border border-border bg-card p-5">
        <AnimatePresence mode="wait">
          {step === "idle" && (
            <motion.div key="idle" exit={{ opacity: 0 }} className="text-center space-y-3">
              <p className="font-display font-semibold text-foreground">Pronto para iniciar seu projeto?</p>
              <p className="text-sm text-muted-foreground font-body">
                Após iniciar, agendamos seu briefing com a Lorena e começamos seu Projeto 3D.
              </p>

              {/* Primary CTA */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setStep("form")}
                className="w-full h-11 rounded-lg bg-success text-success-foreground font-display font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="h-5 w-5" />
                Iniciar meu projeto
              </motion.button>

              {/* Secondary CTA — WhatsApp doubt */}
              <a
                href={whatsappDoubtUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-9 rounded-lg border border-border text-foreground font-display font-semibold text-sm hover:bg-muted/50 transition-colors flex items-center justify-center gap-2"
              >
                <MessageCircle className="h-4 w-4" />
                Tenho uma dúvida
              </a>

              {/* Tertiary CTA — Save for later */}
              <button
                onClick={() => setSaveOpen(true)}
                className="w-full h-8 rounded-lg text-muted-foreground font-body text-sm hover:text-foreground hover:bg-muted/30 transition-colors flex items-center justify-center gap-1.5"
              >
                <Bookmark className="h-3.5 w-3.5" />
                Salvar para revisar depois
              </button>

              {/* Microcopy */}
              <p className="text-xs text-muted-foreground font-body text-center mt-3">
                Sem compromisso. Tire suas dúvidas antes de decidir.
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
                maxLength={100}
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

      {/* Save-for-later Dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Salve este orçamento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground font-body">
            Enviaremos o link para seu email para fácil acesso.
          </p>
          <div className="space-y-3 mt-2">
            <Input
              type="text"
              placeholder="Seu nome"
              value={leadName}
              onChange={(e) => setLeadName(e.target.value)}
              maxLength={100}
            />
            <Input
              type="email"
              placeholder="seu@email.com"
              value={leadEmail}
              onChange={(e) => setLeadEmail(e.target.value)}
              maxLength={255}
            />
            <Button
              onClick={handleSaveLead}
              disabled={saving}
              className="w-full"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
