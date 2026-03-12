import { useState } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Bookmark, Loader2, AlertTriangle } from "lucide-react";
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
  clientName?: string;
}

const DEFAULT_PHONE = "5511911906183";

export function ApprovalCTA({ budgetId, publicId, expired, projectName, clientName }: ApprovalCTAProps) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [leadEmail, setLeadEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const whatsappMessage = encodeURIComponent(
    `Olá! Sou ${clientName || 'cliente'}, estou analisando o orçamento do projeto ${projectName || 'do projeto'} (Ref: ${publicId}) e gostaria de conversar sobre os próximos passos.`
  );
  const whatsappUrl = `https://wa.me/${DEFAULT_PHONE}?text=${whatsappMessage}`;

  const whatsappUpdateUrl = `https://wa.me/${DEFAULT_PHONE}?text=${encodeURIComponent(
    `Olá! O orçamento ${projectName || 'do projeto'} (Ref: ${publicId}) expirou. Gostaria de solicitar uma atualização de valores.`
  )}`;

  const handleSaveLead = async () => {
    if (!leadEmail.trim()) {
      toast.error("Preencha seu email.");
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
        }),
      });
      toast.success("Link salvo! Você pode acessar a qualquer momento.");
      setSaveOpen(false);
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    }
    setSaving(false);
  };

  if (expired) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-5 text-center space-y-3">
        <AlertTriangle className="h-6 w-6 text-destructive mx-auto" />
        <p className="font-display font-semibold text-foreground text-sm">Condições expiradas</p>
        <p className="text-xs text-muted-foreground font-body">
          Os valores desta proposta não estão mais vigentes.
        </p>
        <a
          href={whatsappUpdateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full h-12 rounded-lg bg-primary text-primary-foreground font-display font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <MessageCircle className="h-4 w-4" />
          Solicitar atualização
        </a>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {/* Primary — Falar com especialista */}
        <motion.a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full h-12 rounded-lg bg-primary text-primary-foreground font-display font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <MessageCircle className="h-5 w-5" />
          Iniciar meu projeto
        </motion.a>

        {/* Secondary — Salvar para revisar depois */}
        <button
          onClick={() => setSaveOpen(true)}
          className="w-full h-10 rounded-lg border border-border text-foreground font-body font-medium text-sm hover:bg-muted/50 transition-colors flex items-center justify-center gap-2"
        >
          <Bookmark className="h-4 w-4" />
          Receber por email
        </button>
      </div>

      {/* Save Dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Receber esta proposta por email</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground font-body">
            Enviaremos o link deste orçamento para seu email.
          </p>
          <div className="space-y-3 mt-2">
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
