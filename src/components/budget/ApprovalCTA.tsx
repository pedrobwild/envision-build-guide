import { useState } from "react";
import { motion } from "framer-motion";
import { FileSignature, Bookmark, Loader2, AlertTriangle, MessageCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContractRequestDialog } from "./ContractRequestDialog";
import { supabase } from "@/integrations/supabase/client";

interface ApprovalCTAProps {
  budgetId: string;
  publicId: string;
  approvedAt?: string | null;
  approvedByName?: string | null;
  expired?: boolean;
  projectName?: string;
  clientName?: string;
  total?: number;
  /** Quando true, exibe fluxo de aprovação de aditivo (chama RPC approve_addendum). */
  isAddendum?: boolean;
  addendumNumber?: number | null;
  addendumApprovedAt?: string | null;
  addendumApprovedByName?: string | null;
}

const DEFAULT_PHONE = "5511911906183";

export function ApprovalCTA({
  budgetId,
  publicId,
  expired,
  projectName,
  clientName,
  total = 0,
  isAddendum = false,
  addendumNumber,
  addendumApprovedAt,
  addendumApprovedByName,
}: ApprovalCTAProps) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [addendumApproveOpen, setAddendumApproveOpen] = useState(false);
  const [leadEmail, setLeadEmail] = useState("");
  const [approverName, setApproverName] = useState(clientName || "");
  const [saving, setSaving] = useState(false);
  const [approvingAddendum, setApprovingAddendum] = useState(false);
  const [locallyApproved, setLocallyApproved] = useState<{ at: string; by: string } | null>(null);

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
      toast.success("Pronto! Você pode acessar esta proposta a qualquer momento.");
      setSaveOpen(false);
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    }
    setSaving(false);
  };

  const handleApproveAddendum = async () => {
    const trimmed = approverName.trim();
    if (!trimmed) {
      toast.error("Informe seu nome para aprovar o aditivo.");
      return;
    }
    setApprovingAddendum(true);
    try {
      const { data, error } = await supabase.rpc("approve_addendum", {
        p_public_id: publicId,
        p_approved_by_name: trimmed.substring(0, 200),
      });
      if (error) throw error;
      if (data === true) {
        setLocallyApproved({ at: new Date().toISOString(), by: trimmed });
        setAddendumApproveOpen(false);
        toast.success("Aditivo aprovado! A equipe foi notificada.");
      } else {
        toast.error("Não foi possível aprovar — verifique se este aditivo já foi aprovado anteriormente.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao aprovar.");
    }
    setApprovingAddendum(false);
  };

  // ── EXPIRED ──
  if (expired) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-5 text-center space-y-3">
        <AlertTriangle className="h-6 w-6 text-destructive mx-auto" />
        <p className="budget-heading font-semibold text-foreground text-sm">Condições expiradas</p>
        <p className="text-xs text-muted-foreground font-body">
          Os valores desta proposta não estão mais vigentes.
        </p>
        <a
          href={whatsappUpdateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full h-12 rounded-lg bg-primary text-primary-foreground font-body font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <MessageCircle className="h-4 w-4" />
          Solicitar atualização
        </a>
      </div>
    );
  }

  // ── ADITIVO ──
  if (isAddendum) {
    const approvedAt = locallyApproved?.at ?? addendumApprovedAt;
    const approvedBy = locallyApproved?.by ?? addendumApprovedByName;
    const alreadyApproved = !!approvedAt;

    if (alreadyApproved) {
      return (
        <div className="rounded-lg border border-success/30 bg-success/5 p-5 space-y-2 text-center">
          <CheckCircle2 className="h-6 w-6 text-success mx-auto" />
          <p className="budget-heading font-semibold text-foreground text-sm">
            Aditivo Nº {addendumNumber ?? 1} aprovado
          </p>
          {approvedBy && (
            <p className="text-xs text-muted-foreground font-body">
              Por <strong className="text-foreground">{approvedBy}</strong>
              {approvedAt && (
                <> em {new Date(approvedAt).toLocaleDateString("pt-BR")}</>
              )}
            </p>
          )}
        </div>
      );
    }

    return (
      <>
        <div className="space-y-2">
          <motion.button
            onClick={() => setAddendumApproveOpen(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full h-12 rounded-lg bg-primary text-primary-foreground font-body font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="h-5 w-5" />
            Aprovar Aditivo Nº {addendumNumber ?? 1}
          </motion.button>
          <p className="text-[11px] text-muted-foreground font-body text-center px-2 leading-relaxed">
            Ao aprovar, você concorda com as alterações de escopo e o novo valor de investimento.
          </p>
        </div>

        <Dialog open={addendumApproveOpen} onOpenChange={setAddendumApproveOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="budget-heading">Aprovar Aditivo Nº {addendumNumber ?? 1}</DialogTitle>
              <DialogDescription className="font-body">
                Confirme seu nome para registrar a aprovação. A equipe da BWild será notificada.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <Input
                type="text"
                placeholder="Seu nome completo"
                value={approverName}
                onChange={(e) => setApproverName(e.target.value)}
                maxLength={200}
                autoFocus
              />
              <Button
                onClick={handleApproveAddendum}
                disabled={approvingAddendum}
                className="w-full"
              >
                {approvingAddendum ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Confirmar aprovação
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // ── PADRÃO ──
  return (
    <>
      <div className="space-y-2">
        {/* Primary — Solicitar Contrato */}
        <motion.button
          onClick={() => setContractOpen(true)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full h-12 rounded-lg bg-primary text-primary-foreground font-body font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <FileSignature className="h-5 w-5" />
          Solicitar Contrato
        </motion.button>

        {/* Secondary — Salvar para revisar depois */}
        <button
          onClick={() => setSaveOpen(true)}
          className="w-full h-10 rounded-lg border border-border text-foreground font-body font-medium text-sm hover:bg-muted/50 transition-colors flex items-center justify-center gap-2"
        >
          <Bookmark className="h-4 w-4" />
          Receber por email
        </button>
      </div>

      {/* Contract Request Dialog */}
      <ContractRequestDialog
        open={contractOpen}
        onOpenChange={setContractOpen}
        budgetId={budgetId}
        publicId={publicId}
        projectName={projectName}
        total={total}
      />

      {/* Save Dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="budget-heading">Receber esta proposta por email</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground font-body">
            Enviaremos o link desta proposta para você acessar quando quiser.
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
