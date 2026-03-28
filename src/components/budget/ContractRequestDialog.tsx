import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, FileSignature, ChevronDown, Send } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/formatBRL";

interface ContractRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetId: string;
  publicId: string;
  projectName?: string;
  total: number;
  consultoraComercial?: string;
}

const installmentOptions = Array.from({ length: 18 }, (_, i) => ({
  months: i + 1,
  label: `${i + 1}× sem juros`,
}));

const DEFAULT_PHONE = "5511911906183";

export function ContractRequestDialog({
  open,
  onOpenChange,
  budgetId,
  publicId,
  projectName,
  total,
  consultoraComercial,
}: ContractRequestDialogProps) {
  const [sending, setSending] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  // Personal data
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [nacionalidade, setNacionalidade] = useState("");
  const [estadoCivil, setEstadoCivil] = useState("");
  const [profissao, setProfissao] = useState("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [endereco, setEndereco] = useState("");
  const [email, setEmail] = useState("");

  // Property data
  const [unidade, setUnidade] = useState("");
  const [metragem, setMetragem] = useState("");
  const [empreendimento, setEmpreendimento] = useState("");
  const [enderecoImovel, setEnderecoImovel] = useState("");

  // Payment
  const [parcelas, setParcelas] = useState(10);

  const selectedOption = installmentOptions.find((o) => o.months === parcelas)!;

  const validate = () => {
    if (!nomeCompleto.trim()) { toast.error("Preencha o nome completo."); return false; }
    if (!cpf.trim()) { toast.error("Preencha o CPF."); return false; }
    if (!rg.trim()) { toast.error("Preencha o RG."); return false; }
    if (!endereco.trim()) { toast.error("Preencha o endereço residencial."); return false; }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { toast.error("Preencha um email válido."); return false; }
    if (!unidade.trim()) { toast.error("Preencha a unidade do imóvel."); return false; }
    if (!empreendimento.trim()) { toast.error("Preencha o nome do empreendimento."); return false; }
    if (!enderecoImovel.trim()) { toast.error("Preencha o endereço do imóvel."); return false; }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSending(true);

    try {
      // Update budget status to minuta_solicitada
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      await fetch(`${supabaseUrl}/rest/v1/budgets?id=eq.${encodeURIComponent(budgetId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          status: "minuta_solicitada",
          lead_name: nomeCompleto.trim().substring(0, 255),
          lead_email: email.trim().substring(0, 255),
        }),
      });

      // Build WhatsApp message
      const valorParcela = formatBRL(total / parcelas);
      const msg = [
        `📋 *SOLICITAÇÃO DE CONTRATO*`,
        ``,
        `*Projeto:* ${projectName || "—"}`,
        `*Ref:* ${publicId}`,
        ``,
        `👤 *CONTRATANTE*`,
        `Nome: ${nomeCompleto}`,
        nacionalidade ? `Nacionalidade: ${nacionalidade}` : null,
        estadoCivil ? `Estado civil: ${estadoCivil}` : null,
        profissao ? `Profissão: ${profissao}` : null,
        `CPF: ${cpf}`,
        `RG: ${rg}`,
        `Endereço: ${endereco}`,
        `Email: ${email}`,
        ``,
        `🏠 *IMÓVEL*`,
        `Unidade: ${unidade}`,
        metragem ? `Metragem: ${metragem}` : null,
        `Empreendimento: ${empreendimento}`,
        `Endereço: ${enderecoImovel}`,
        ``,
        `💳 *PAGAMENTO*`,
        `${parcelas}× de ${valorParcela} (total ${formatBRL(total)})`,
      ].filter(Boolean).join("\n");

      const whatsappUrl = `https://wa.me/${DEFAULT_PHONE}?text=${encodeURIComponent(msg)}`;
      window.open(whatsappUrl, "_blank");

      toast.success("Solicitação enviada! Redirecionando para o WhatsApp...");
      onOpenChange(false);
    } catch {
      toast.error("Erro ao enviar. Tente novamente.");
    }
    setSending(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" />
            Solicitar Contrato
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground font-body">
          Preencha os dados abaixo para solicitar a elaboração do contrato. As informações serão enviadas à consultora comercial.
        </p>

        <div className="space-y-5 mt-2">
          {/* Section: Personal Data */}
          <div className="space-y-3">
            <h3 className="font-display font-semibold text-sm text-foreground border-b border-border pb-1">
              Dados do Contratante
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label className="text-xs font-body">Nome completo *</Label>
                <Input value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} maxLength={200} placeholder="Nome completo" />
              </div>
              <div>
                <Label className="text-xs font-body">Nacionalidade</Label>
                <Input value={nacionalidade} onChange={(e) => setNacionalidade(e.target.value)} maxLength={60} placeholder="Ex: brasileira" />
              </div>
              <div>
                <Label className="text-xs font-body">Estado civil</Label>
                <Input value={estadoCivil} onChange={(e) => setEstadoCivil(e.target.value)} maxLength={30} placeholder="Ex: casada" />
              </div>
              <div>
                <Label className="text-xs font-body">Profissão</Label>
                <Input value={profissao} onChange={(e) => setProfissao(e.target.value)} maxLength={80} placeholder="Ex: engenheira civil" />
              </div>
              <div>
                <Label className="text-xs font-body">CPF *</Label>
                <Input value={cpf} onChange={(e) => setCpf(e.target.value)} maxLength={14} placeholder="000.000.000-00" />
              </div>
              <div>
                <Label className="text-xs font-body">RG *</Label>
                <Input value={rg} onChange={(e) => setRg(e.target.value)} maxLength={20} placeholder="0000.000" />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs font-body">Endereço residencial *</Label>
                <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} maxLength={300} placeholder="Rua, número, bairro, cidade/UF, CEP" />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs font-body">E-mail *</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} placeholder="seu@email.com" />
              </div>
            </div>
          </div>

          {/* Section: Property */}
          <div className="space-y-3">
            <h3 className="font-display font-semibold text-sm text-foreground border-b border-border pb-1">
              Dados do Imóvel
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-body">Unidade / Apartamento *</Label>
                <Input value={unidade} onChange={(e) => setUnidade(e.target.value)} maxLength={20} placeholder="Ex: U0617" />
              </div>
              <div>
                <Label className="text-xs font-body">Metragem</Label>
                <Input value={metragem} onChange={(e) => setMetragem(e.target.value)} maxLength={20} placeholder="Ex: 31m²" />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs font-body">Empreendimento *</Label>
                <Input value={empreendimento} onChange={(e) => setEmpreendimento(e.target.value)} maxLength={200} placeholder="Nome do empreendimento" />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs font-body">Endereço do imóvel *</Label>
                <Input value={enderecoImovel} onChange={(e) => setEnderecoImovel(e.target.value)} maxLength={300} placeholder="Rua, número, bairro, cidade/UF, CEP" />
              </div>
            </div>
          </div>

          {/* Section: Payment */}
          <div className="space-y-3">
            <h3 className="font-display font-semibold text-sm text-foreground border-b border-border pb-1">
              Forma de Pagamento
            </h3>
            <p className="text-xs text-muted-foreground font-body">
              Cartão de crédito em até 18× sem juros.
            </p>
            <div className="relative">
              <button
                type="button"
                onClick={() => setPaymentOpen(!paymentOpen)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-muted/50 hover:bg-muted transition-colors text-sm font-body"
              >
                <span className="text-foreground font-medium">
                  {selectedOption.label} — {formatBRL(total / parcelas)}/mês
                </span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${paymentOpen ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {paymentOpen && (
                  <motion.ul
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute z-10 mt-1 w-full bg-card border border-border rounded-lg shadow-lg overflow-y-auto max-h-48"
                  >
                    {installmentOptions.map((opt) => (
                      <li key={opt.months}>
                        <button
                          type="button"
                          onClick={() => { setParcelas(opt.months); setPaymentOpen(false); }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-sm font-body transition-colors ${
                            parcelas === opt.months
                              ? "bg-primary/10 text-primary font-semibold"
                              : "text-foreground hover:bg-muted"
                          }`}
                        >
                          <span>{opt.label}</span>
                          <span className="font-semibold tabular-nums">{formatBRL(total / opt.months)}</span>
                        </button>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>

            <div className="text-center pt-1">
              <p className="font-display font-bold text-lg text-primary tabular-nums">
                {parcelas}× de {formatBRL(total / parcelas)}
              </p>
              <p className="text-xs text-muted-foreground font-body">Total: {formatBRL(total)}</p>
            </div>
          </div>

          {/* Submit */}
          <Button onClick={handleSubmit} disabled={sending} className="w-full h-12 gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar solicitação
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
