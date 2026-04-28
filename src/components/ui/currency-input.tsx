import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * CurrencyInput — máscara BRL incremental (digite cents da direita p/ esquerda).
 *
 * - Aceita valores negativos (toggle pela tecla "-" ou prefixo do texto).
 * - Renderiza "R$ 1.234,56" / "−R$ 1.234,56" enquanto o usuário digita.
 * - O valor exposto via onChange é um number em REAIS (ou null se vazio).
 * - Edição não-destrutiva: o cursor sempre permanece no fim (padrão de
 *   máscara incremental amplamente usado em fintech BR).
 *
 * Aceita colar "-R$ 3.000,00", "-3000", "R$ 3000,00" etc.
 */

interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  /** Permitir valores negativos (default: true) */
  allowNegative?: boolean;
  /** Classe extra para alinhamento e tipografia */
  className?: string;
  /** Placeholder customizado (default: "R$ 0,00") */
  placeholder?: string;
}

/** Converte número de reais em string formatada "R$ 1.234,56" ou "−R$ 1.234,56". */
function formatCurrency(value: number): string {
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);
  const formatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  return sign + formatted;
}

/** Extrai apenas dígitos e detecta sinal negativo do texto livre digitado/colado. */
function parseRawInput(raw: string, allowNegative: boolean): { cents: string; negative: boolean } {
  const negative = allowNegative && /[-−]/.test(raw);
  const digits = raw.replace(/\D/g, "");
  return { cents: digits, negative };
}

/** Converte string de centavos ("30000") + sinal em number de reais (300.00 / -300.00). */
function centsToNumber(cents: string, negative: boolean): number | null {
  if (!cents) return null;
  // Remove zeros à esquerda mantendo pelo menos um dígito
  const trimmed = cents.replace(/^0+/, "") || "0";
  const n = Number(trimmed) / 100;
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Converte number de reais para string de centavos sem sinal. */
function numberToCents(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  const cents = Math.round(Math.abs(value) * 100);
  return String(cents);
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, allowNegative = true, className, placeholder = "R$ 0,00", onKeyDown, onPaste, ...rest }, ref) => {
    // Estado interno: string de centavos + sinal. Sincroniza com prop value
    // somente quando a representação numérica diverge (evita sobrescrever a digitação).
    const [cents, setCents] = React.useState<string>(() => numberToCents(value));
    const [negative, setNegative] = React.useState<boolean>(() => (value ?? 0) < 0);

    React.useEffect(() => {
      const currentNum = centsToNumber(cents, negative);
      const propNum = value ?? null;
      // Considera iguais com tolerância de 0.005 para evitar loops por arredondamento
      const isSame =
        (currentNum == null && propNum == null) ||
        (currentNum != null && propNum != null && Math.abs(currentNum - propNum) < 0.005);
      if (!isSame) {
        setCents(numberToCents(value));
        setNegative((value ?? 0) < 0);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const display = React.useMemo(() => {
      const num = centsToNumber(cents, negative);
      if (num == null) {
        return negative ? "−" : "";
      }
      return formatCurrency(num);
    }, [cents, negative]);

    const emitChange = React.useCallback(
      (nextCents: string, nextNegative: boolean) => {
        setCents(nextCents);
        setNegative(nextNegative);
        onChange(centsToNumber(nextCents, nextNegative));
      },
      [onChange],
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      // Detecta sinal a partir do texto inteiro (suporta colar "-R$ 3.000")
      const parsed = parseRawInput(raw, allowNegative);
      // Trunca em 12 dígitos (até R$ 9.999.999.999,99) para evitar overflow visual
      const truncated = parsed.cents.slice(0, 12);
      emitChange(truncated, parsed.negative);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Toggle de sinal pela tecla "-" em qualquer posição do cursor
      if (allowNegative && (e.key === "-" || e.key === "−")) {
        e.preventDefault();
        emitChange(cents, !negative);
        return;
      }
      // Backspace: remove o último dígito (último centavo)
      if (e.key === "Backspace") {
        e.preventDefault();
        if (cents.length > 0) {
          const next = cents.slice(0, -1);
          emitChange(next, next === "" ? false : negative);
        } else if (negative) {
          // Já vazio mas com sinal: limpa sinal
          emitChange("", false);
        }
        return;
      }
      // Delete: limpa tudo
      if (e.key === "Delete") {
        e.preventDefault();
        emitChange("", false);
        return;
      }
      onKeyDown?.(e);
    };

    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={display}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={onPaste}
        placeholder={placeholder}
        className={cn("tabular-nums", className)}
        {...rest}
      />
    );
  },
);

CurrencyInput.displayName = "CurrencyInput";
