import { useEffect, useRef, useState } from "react";
import { Clock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * PrazoExecucaoChip
 *
 * Editor inline para o campo `prazo_dias_uteis` no cabeçalho de telas admin
 * (Budget Editor e Demanda). Mantém UX consistente entre as duas telas:
 *
 *   - Quando há valor: mostra um chip "⏱ 30 dias úteis · ≈ 6 sem" clicável.
 *     Ao clicar, vira um input pequeno; salva ao sair (blur) ou Enter.
 *   - Quando não há valor: mostra um botão "+ Definir prazo de execução"
 *     destacado em cor primária para lembrar a orçamentista de preencher
 *     antes de publicar.
 *
 * O componente é puramente apresentacional: a persistência fica a cargo
 * do `onChange` recebido do parent, que tipicamente delega para o
 * autosave do orçamento (mesma rotina que salva os demais metadados).
 *
 * Aceita apenas inteiros não negativos. Valores inválidos são ignorados;
 * limpar o input salva null.
 */
export interface PrazoExecucaoChipProps {
  /** Valor atual em dias úteis. `null`/`undefined` indica não definido. */
  value: number | null | undefined;
  /** Persiste o novo valor (ou `null` para limpar). */
  onChange: (next: number | null) => void;
  /** Esconde o componente em modo somente-leitura (default: false). */
  readOnly?: boolean;
  /**
   * Aparência do chip:
   *  - "light": fundo claro, texto escuro (default; usado em telas admin)
   *  - "dark": para fundos escuros (header público, futuro uso)
   */
  tone?: "light" | "dark";
  /**
   * Tamanho:
   *  - "md" (default): tamanho normal, ideal abaixo do H1
   *  - "sm": compacto, casa com Badge do shadcn em barras de status
   *    (omite a aproximação de semanas para economizar espaço).
   */
  size?: "sm" | "md";
  /** Classes extras aplicadas ao container raiz. */
  className?: string;
}

function approxWeeks(days: number): number {
  // Convenção do produto: 5 dias úteis = 1 semana.
  return Math.ceil(days / 5);
}

export function PrazoExecucaoChip({
  value,
  onChange,
  readOnly = false,
  tone = "light",
  size = "md",
  className,
}: PrazoExecucaoChipProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value != null ? String(value) : "");
  const inputRef = useRef<HTMLInputElement>(null);

  // Sincroniza o rascunho quando o valor externo muda (ex.: outro user editou,
  // fork de versão publicada). Não interrompe edição em andamento.
  useEffect(() => {
    if (!editing) {
      setDraft(value != null ? String(value) : "");
    }
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === "") {
      // Apaga o valor quando o input fica vazio.
      if (value != null) onChange(null);
      setEditing(false);
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      // Entrada inválida: descarta e sai do modo edição sem mexer no estado.
      setDraft(value != null ? String(value) : "");
      setEditing(false);
      return;
    }
    if (n !== value) onChange(n);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value != null ? String(value) : "");
    setEditing(false);
  };

  // ────────────────────────────────────────────────────────────────────────
  // Estilo
  // ────────────────────────────────────────────────────────────────────────
  const isDark = tone === "dark";
  const baseChip = isDark
    ? "bg-white/10 text-white/85 hover:bg-white/15 border-white/10"
    : "bg-muted/60 text-foreground hover:bg-muted border-border/60";
  const baseEmpty = isDark
    ? "bg-white/5 text-white/70 hover:bg-white/10 border-white/15 border-dashed"
    : "bg-primary/5 text-primary hover:bg-primary/10 border-primary/30 border-dashed";

  // Tokens de tamanho — "sm" pareia com Badge do shadcn (text-[10px], px-2 py-0.5).
  const sizing =
    size === "sm" ? "px-2 py-0.5 text-[10px] gap-1" : "px-2 py-1 text-xs gap-1.5";
  const iconSize = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";
  const inputWidth = size === "sm" ? "w-10" : "w-14";

  if (editing) {
    return (
      <div
        className={cn(
          "inline-flex items-center rounded-md border font-body",
          sizing,
          baseChip,
          className,
        )}
      >
        <Clock className={cn(iconSize, "opacity-60")} aria-hidden />
        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          aria-label="Dias úteis de execução da obra"
          className={cn(
            inputWidth,
            "bg-transparent outline-none border-none p-0 m-0",
            "[&::-webkit-inner-spin-button]:appearance-none",
            "[&::-webkit-outer-spin-button]:appearance-none",
            "[appearance:textfield]",
          )}
        />
        <span className="opacity-70">dias úteis</span>
      </div>
    );
  }

  if (value == null || value <= 0) {
    if (readOnly) return null;
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={cn(
          "inline-flex items-center rounded-md border font-body font-medium transition-colors",
          sizing,
          baseEmpty,
          className,
        )}
      >
        <Plus className={iconSize} aria-hidden />
        {size === "sm" ? "Definir prazo" : "Definir prazo de execução"}
      </button>
    );
  }

  // Valor preenchido — chip clicável (ou apenas leitura). Em "sm" omitimos a
  // aproximação de semanas para caber em barras de status.
  const content = (
    <>
      <Clock className={cn(iconSize, "opacity-60")} aria-hidden />
      <span className="budget-numeric font-medium">{value}</span>
      <span>dias úteis</span>
      {size === "md" && (
        <>
          <span className="opacity-50">·</span>
          <span className="opacity-70">≈ {approxWeeks(value)} sem</span>
        </>
      )}
    </>
  );

  if (readOnly) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-md border font-body",
          sizing,
          baseChip,
          className,
        )}
        aria-label={`Prazo de execução: ${value} dias úteis`}
      >
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        "inline-flex items-center rounded-md border font-body transition-colors",
        sizing,
        baseChip,
        className,
      )}
      aria-label={`Editar prazo de execução (atual: ${value} dias úteis)`}
      title="Clique para editar o prazo de execução"
    >
      {content}
    </button>
  );
}
