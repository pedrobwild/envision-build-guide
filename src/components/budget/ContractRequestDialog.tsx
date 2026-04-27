import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, FileSignature, ChevronDown, Send, ChevronRight, ChevronLeft, User, Home, CreditCard } from "lucide-react";
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
import { cn } from "@/lib/utils";

interface ContractRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetId: string;
  publicId: string;
  projectName?: string;
  total: number;
  consultoraComercial?: string;
}

const installmentOptions = Array.from({ length: 12 }, (_, i) => ({
  months: i + 1,
  label: `${i + 1}× sem juros`,
}));

const DEFAULT_PHONE = "5511911906183";

const STEPS = [
  { label: "Contratante", icon: User },
  { label: "Imóvel", icon: Home },
  { label: "Pagamento", icon: CreditCard },
] as const;

/** Format CPF: 000.000.000-00 */
function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/* ── Stepper indicator ── */
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 py-3" role="progressbar" aria-valuenow={current + 1} aria-valuemin={1} aria-valuemax={total}>
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const isActive = i === current;
        const isDone = i < current;
        return (
          <div key={step.label} className="flex items-center gap-1.5">
            {i > 0 && (
              <div className={cn("w-6 h-px transition-colors duration-300", isDone ? "bg-primary" : "bg-border")} />
            )}
            <div className="flex flex-col items-center gap-0.5">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 text-xs font-display font-bold",
                  isActive
                    ? "bg-primary text-primary-foreground scale-110 shadow-md shadow-primary/20"
                    : isDone
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {isDone ? "✓" : <Icon className="h-3.5 w-3.5" />}
              </div>
              <span className={cn(
                "text-[10px] font-body font-medium transition-colors duration-200",
                isActive ? "text-primary" : isDone ? "text-primary/70" : "text-muted-foreground"
              )}>
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Slide animation variants ── */
const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
};

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
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
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

  // Property
  const [unidade, setUnidade] = useState("");
  const [metragem, setMetragem] = useState("");
  const [empreendimento, setEmpreendimento] = useState("");
  const [enderecoImovel, setEnderecoImovel] = useState("");

  // Payment
  type PaymentMethod = "cartao" | "fluxo_obra";
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cartao");
  const MAX_INSTALLMENTS = 12;
  const [parcelas, setParcelasState] = useState(10);

  const setParcelas = useCallback((value: number) => {
    if (!Number.isInteger(value) || value < 1) {
      toast.error("Selecione um número de parcelas válido (1 a 12).");
      return;
    }
    if (value > MAX_INSTALLMENTS) {
      toast.warning(`Parcelamento no cartão limitado a ${MAX_INSTALLMENTS}× sem juros.`);
      setParcelasState(MAX_INSTALLMENTS);
      return;
    }
    setParcelasState(value);
  }, []);

  const selectedOption =
    installmentOptions.find((o) => o.months === parcelas) ?? installmentOptions[installmentOptions.length - 1];

  const handleCpfChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCpf(formatCpf(e.target.value));
  }, []);

  const validateStep = (s: number): boolean => {
    if (s === 0) {
      if (!nomeCompleto.trim()) { toast.error("Preencha o nome completo."); return false; }
      if (!cpf.trim() || cpf.replace(/\D/g, "").length < 11) { toast.error("Preencha o CPF completo."); return false; }
      if (!rg.trim()) { toast.error("Preencha o RG."); return false; }
      if (!endereco.trim()) { toast.error("Preencha o endereço residencial."); return false; }
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { toast.error("Preencha um email válido."); return false; }
    }
    if (s === 1) {
      if (!unidade.trim()) { toast.error("Preencha a unidade do imóvel."); return false; }
      if (!empreendimento.trim()) { toast.error("Preencha o nome do empreendimento."); return false; }
      if (!enderecoImovel.trim()) { toast.error("Preencha o endereço do imóvel."); return false; }
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setDirection(1);
    setStep((s) => Math.min(s + 1, 2));
  };

  const goBack = () => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleSubmit = async () => {
    if (!validateStep(0) || !validateStep(1)) return;
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
          parcelas: paymentMethod === "cartao" ? parcelas : 1,
          payment_method: paymentMethod,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.details?.join(", ") || err.error || "Erro na validação.");
        setSending(false);
        return;
      }

      const parcelasValidas =
        Number.isInteger(parcelas) && parcelas >= 1 && parcelas <= MAX_INSTALLMENTS;
      const totalFmt = formatBRL(total);
      let pagamentoLinha: string;
      if (paymentMethod === "cartao") {
        if (parcelasValidas) {
          const valorParcela = formatBRL(total / parcelas);
          pagamentoLinha = `Cartão de crédito — ${parcelas}× de ${valorParcela} (total ${totalFmt})`;
        } else {
          pagamentoLinha = `Cartão de crédito (total ${totalFmt}) — número de parcelas a confirmar com a consultora (até ${MAX_INSTALLMENTS}× sem juros)`;
        }
      } else if (paymentMethod === "fluxo_obra") {
        pagamentoLinha = `Parcelamento no fluxo da obra (total ${totalFmt}) — condições a combinar com a consultora`;
      } else {
        pagamentoLinha = `Total ${totalFmt} — forma de pagamento a combinar com a consultora`;
      }
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
        pagamentoLinha,
      ].filter(Boolean).join("\n");

      const whatsappUrl = `https://wa.me/${DEFAULT_PHONE}?text=${encodeURIComponent(msg)}`;
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");

      toast.success("Solicitação enviada! Redirecionando para o WhatsApp...");
      onOpenChange(false);
    } catch {
      toast.error("Erro ao enviar. Tente novamente.");
    }
    setSending(false);
  };

  return (
    <div className="space-y-4">
      {/* Stepper */}
      <StepIndicator current={step} total={3} />

      {/* Step content with slide animation */}
      <div className="relative overflow-hidden min-h-[280px]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {step === 0 && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground font-body">
                  Preencha os dados do contratante para a elaboração da minuta.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <Label htmlFor="cr-nome" className="text-xs font-body">Nome completo *</Label>
                    <Input id="cr-nome" value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} maxLength={200} placeholder="Nome completo" autoComplete="name" autoFocus />
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
            )}

            {step === 1 && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground font-body">
                  Informe os dados do imóvel que será reformado.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="cr-unidade" className="text-xs font-body">Unidade / Apartamento *</Label>
                    <Input id="cr-unidade" value={unidade} onChange={(e) => setUnidade(e.target.value)} maxLength={20} placeholder="Ex: U0617" autoFocus />
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
            )}

            {step === 2 && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground font-body">
                  Escolha como prefere pagar. Você pode ajustar com a consultora depois.
                </p>

                {/* Método de pagamento */}
                <div role="radiogroup" aria-label="Método de pagamento" className="grid gap-2">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={paymentMethod === "cartao"}
                    onClick={() => setPaymentMethod("cartao")}
                    className={cn(
                      "w-full text-left rounded-lg border px-3 py-3 transition-colors min-h-[56px]",
                      paymentMethod === "cartao"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border bg-muted/30 hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-body font-semibold text-foreground">Cartão de crédito</p>
                        <p className="text-xs text-muted-foreground font-body">Em até 12× sem juros</p>
                      </div>
                      <div
                        className={cn(
                          "h-4 w-4 rounded-full border-2 flex-shrink-0",
                          paymentMethod === "cartao" ? "border-primary bg-primary" : "border-border"
                        )}
                        aria-hidden="true"
                      />
                    </div>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={paymentMethod === "fluxo_obra"}
                    onClick={() => setPaymentMethod("fluxo_obra")}
                    className={cn(
                      "w-full text-left rounded-lg border px-3 py-3 transition-colors min-h-[56px]",
                      paymentMethod === "fluxo_obra"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border bg-muted/30 hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-body font-semibold text-foreground">Parcelamento no fluxo da obra</p>
                        <p className="text-xs text-muted-foreground font-body">Pagamentos atrelados às etapas da execução</p>
                      </div>
                      <div
                        className={cn(
                          "h-4 w-4 rounded-full border-2 flex-shrink-0",
                          paymentMethod === "fluxo_obra" ? "border-primary bg-primary" : "border-border"
                        )}
                        aria-hidden="true"
                      />
                    </div>
                  </button>
                </div>

                {/* Seletor de parcelas (apenas para cartão) */}
                {paymentMethod === "cartao" && (
                  <div className="relative">
                    <Label className="text-xs font-body block mb-1.5">Parcelas</Label>
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
                      <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", paymentOpen && "rotate-180")} />
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
                                className={cn(
                                  "w-full flex items-center justify-between px-3 py-2 text-sm font-body transition-colors min-h-[44px]",
                                  parcelas === opt.months
                                    ? "bg-primary/10 text-primary font-semibold"
                                    : "text-foreground hover:bg-muted"
                                )}
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
                )}

                {/* Resumo */}
                <div className="text-center pt-1 pb-1">
                  {paymentMethod === "cartao" ? (
                    <p className="font-display font-bold text-xl text-primary tabular-nums">
                      {parcelas}× de {formatBRL(total / parcelas)}
                    </p>
                  ) : (
                    <p className="font-display font-bold text-lg text-primary">
                      Parcelado no fluxo da obra
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground font-body mt-0.5">Total: {formatBRL(total)}</p>
                </div>

                <p className="text-xs text-muted-foreground font-body text-center">
                  Condições finais alinhadas com sua consultora.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center gap-3 pt-1">
        {step > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            className="gap-1.5 min-h-[48px] flex-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Voltar
          </Button>
        )}

        {step < 2 ? (
          <Button
            type="button"
            onClick={goNext}
            className="gap-1.5 min-h-[48px] flex-1"
          >
            Próximo
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={sending}
            className="gap-2 min-h-[48px] flex-1"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar solicitação
          </Button>
        )}
      </div>
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
