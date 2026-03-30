import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, FileSignature, ChevronDown, Send } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/formatBRL";
import { useIsMobile } from "@/hooks/use-mobile";

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

/** Format CPF: 000.000.000-00 */
function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function ContractForm({
  budgetId,
  publicId,
  projectName,
  total,
  onOpenChange,
}: {
  budgetId: string;
  publicId: string;
  projectName?: string;
  total: number;
  onOpenChange: (open: boolean) => void;
}) {
  const [sending, setSending] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const [nomeCompleto, setNomeCompleto] = useState("");
  const [nacionalidade, setNacionalidade] = useState("");
  const [estadoCivil, setEstadoCivil] = useState("");
  const [profissao, setProfissao] = useState("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [endereco, setEndereco] = useState("");
  const [email, setEmail] = useState("");

  const [unidade, setUnidade] = useState("");
  const [metragem, setMetragem] = useState("");
  const [empreendimento, setEmpreendimento] = useState("");
  const [enderecoImovel, setEnderecoImovel] = useState("");

  const [parcelas, setParcelas] = useState(10);

  const selectedOption = installmentOptions.find((o) => o.months === parcelas)!;

  const handleCpfChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCpf(formatCpf(e.target.value));
  }, []);

  const validate = () => {
    if (!nomeCompleto.trim()) { toast.error("Preencha o nome completo."); return false; }
    if (!cpf.trim() || cpf.replace(/\D/g, "").length < 11) { toast.error("Preencha o CPF completo."); return false; }
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
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/validate-contract-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          budget_id: budgetId,
          nome_completo: nomeCompleto.trim(),
          cpf: cpf.trim(),
          rg: rg.trim(),
          endereco: endereco.trim(),
          email: email.trim(),
          unidade: unidade.trim(),
          metragem: metragem.trim(),
          empreendimento: empreendimento.trim(),
          endereco_imovel: enderecoImovel.trim(),
          nacionalidade: nacionalidade.trim(),
          estado_civil: estadoCivil.trim(),
          profissao: profissao.trim(),
          parcelas,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.details?.join(", ") || err.error || "Erro na validação.");
        setSending(false);
        return;
      }

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
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground font-body">
        Preencha os dados abaixo para solicitar a elaboração do contrato.
      </p>

      {/* Section: Personal Data */}
      <div className="space-y-3">
        <h3 className="font-display font-semibold text-sm text-foreground border-b border-border pb-1">
          Dados do Contratante
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label htmlFor="cr-nome" className="text-xs font-body">Nome completo *</Label>
            <Input id="cr-nome" value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} maxLength={200} placeholder="Nome completo" autoComplete="name" />
          </div>
          <div>
            <Label htmlFor="cr-nacionalidade" className="text-xs font-body">Nacionalidade</Label>
            <Input id="cr-nacionalidade" value={nacionalidade} onChange={(e) => setNacionalidade(e.target.value)} maxLength={60} placeholder="Ex: brasileira" />
          </div>
          <div>
            <Label htmlFor="cr-estado-civil" className="text-xs font-body">Estado civil</Label>
            <Input id="cr-estado-civil" value={estadoCivil} onChange={(e) => setEstadoCivil(e.target.value)} maxLength={30} placeholder="Ex: casada" />
          </div>
          <div>
            <Label htmlFor="cr-profissao" className="text-xs font-body">Profissão</Label>
            <Input id="cr-profissao" value={profissao} onChange={(e) => setProfissao(e.target.value)} maxLength={80} placeholder="Ex: engenheira civil" />
          </div>
          <div>
            <Label htmlFor="cr-cpf" className="text-xs font-body">CPF *</Label>
            <Input id="cr-cpf" value={cpf} onChange={handleCpfChange} maxLength={14} placeholder="000.000.000-00" inputMode="numeric" autoComplete="off" />
          </div>
          <div>
            <Label htmlFor="cr-rg" className="text-xs font-body">RG *</Label>
            <Input id="cr-rg" value={rg} onChange={(e) => setRg(e.target.value)} maxLength={20} placeholder="0000.000" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="cr-endereco" className="text-xs font-body">Endereço residencial *</Label>
            <Input id="cr-endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} maxLength={300} placeholder="Rua, número, bairro, cidade/UF, CEP" autoComplete="street-address" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="cr-email" className="text-xs font-body">E-mail *</Label>
            <Input id="cr-email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} placeholder="seu@email.com" autoComplete="email" />
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
            <Label htmlFor="cr-unidade" className="text-xs font-body">Unidade / Apartamento *</Label>
            <Input id="cr-unidade" value={unidade} onChange={(e) => setUnidade(e.target.value)} maxLength={20} placeholder="Ex: U0617" />
          </div>
          <div>
            <Label htmlFor="cr-metragem" className="text-xs font-body">Metragem</Label>
            <Input id="cr-metragem" value={metragem} onChange={(e) => setMetragem(e.target.value)} maxLength={20} placeholder="Ex: 31m²" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="cr-empreendimento" className="text-xs font-body">Empreendimento *</Label>
            <Input id="cr-empreendimento" value={empreendimento} onChange={(e) => setEmpreendimento(e.target.value)} maxLength={200} placeholder="Nome do empreendimento" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="cr-endereco-imovel" className="text-xs font-body">Endereço do imóvel *</Label>
            <Input id="cr-endereco-imovel" value={enderecoImovel} onChange={(e) => setEnderecoImovel(e.target.value)} maxLength={300} placeholder="Rua, número, bairro, cidade/UF, CEP" />
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
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-muted/50 hover:bg-muted transition-colors text-sm font-body min-h-[44px]"
            aria-expanded={paymentOpen}
            aria-haspopup="listbox"
          >
            <span className="text-foreground font-medium">
              {selectedOption.label} — {formatBRL(total / parcelas)}/mês
            </span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${paymentOpen ? "rotate-180" : ""}`} />
          </button>

          <AnimatePresence>
            {paymentOpen && (
              <motion.ul
                role="listbox"
                aria-label="Opções de parcelamento"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute z-10 mt-1 w-full bg-card border border-border rounded-lg shadow-lg overflow-y-auto max-h-48"
              >
                {installmentOptions.map((opt) => (
                  <li key={opt.months} role="option" aria-selected={parcelas === opt.months}>
                    <button
                      type="button"
                      onClick={() => { setParcelas(opt.months); setPaymentOpen(false); }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm font-body transition-colors min-h-[44px] ${
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
  );
}

export function ContractRequestDialog({
  open,
  onOpenChange,
  budgetId,
  publicId,
  projectName,
  total,
}: ContractRequestDialogProps) {
  const isMobile = useIsMobile();

  const titleContent = (
    <span className="font-display flex items-center gap-2">
      <FileSignature className="h-5 w-5 text-primary" />
      Solicitar Contrato
    </span>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="border-b border-border px-5 py-3.5">
            <DrawerTitle>{titleContent}</DrawerTitle>
          </DrawerHeader>
          <div className="px-5 py-4 overflow-y-auto">
            <ContractForm
              budgetId={budgetId}
              publicId={publicId}
              projectName={projectName}
              total={total}
              onOpenChange={onOpenChange}
            />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titleContent}</DialogTitle>
        </DialogHeader>
        <ContractForm
          budgetId={budgetId}
          publicId={publicId}
          projectName={projectName}
          total={total}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}
