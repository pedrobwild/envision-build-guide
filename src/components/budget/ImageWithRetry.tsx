import { useCallback, useEffect, useState } from "react";
import { Camera, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageWithRetryProps {
  src: string;
  alt: string;
  className?: string;
  /** Texto exibido no estado de erro. Default: "Imagem indisponível". */
  fallbackLabel?: string;
  /** Tenta novamente automaticamente até N vezes antes de exibir o fallback. */
  autoRetries?: number;
  /** loading attribute do <img>. Default: "lazy". */
  loading?: "lazy" | "eager";
  /** Atributos extras para o <img> (decoding, sizes, etc.). */
  imgProps?: Omit<
    React.ImgHTMLAttributes<HTMLImageElement>,
    "src" | "alt" | "className" | "onError" | "onLoad" | "loading"
  >;
}

/**
 * Renderiza uma imagem com fallback visual e botão "tentar novamente"
 * caso o asset não carregue. Não bloqueia a página: exibe um placeholder
 * acessível e permite ao usuário forçar uma nova tentativa.
 *
 * Após `autoRetries` falhas seguidas, exibe o estado final com botão de
 * retry manual. O retry usa cache-busting com query string `?retry=N`
 * para escapar de respostas 404/erro cacheadas pelo navegador/CDN.
 */
export function ImageWithRetry({
  src,
  alt,
  className,
  fallbackLabel = "Imagem indisponível",
  autoRetries = 1,
  loading = "lazy",
  imgProps,
}: ImageWithRetryProps) {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  // Reset quando o src mudar
  useEffect(() => {
    setAttempt(0);
    setStatus("loading");
  }, [src]);

  const handleError = useCallback(() => {
    setAttempt((prev) => {
      const next = prev + 1;
      if (next <= autoRetries) {
        // Permanece em "loading" porque o <img> reseta sozinho com a nova key
        return next;
      }
      setStatus("error");
      return prev;
    });
  }, [autoRetries]);

  const handleLoad = useCallback(() => setStatus("ok"), []);

  const handleManualRetry = useCallback(() => {
    setAttempt((prev) => prev + 1);
    setStatus("loading");
  }, []);

  // Cache-busting: a query muda a cada tentativa para evitar resposta cacheada.
  const computedSrc = attempt === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}retry=${attempt}`;

  if (status === "error") {
    return (
      <div
        className={cn(
          "bg-muted rounded-lg flex flex-col items-center justify-center gap-2 p-3 text-center",
          className
        )}
        role="img"
        aria-label={`${alt} — ${fallbackLabel}`}
      >
        <Camera className="h-7 w-7 text-muted-foreground/50" aria-hidden />
        <span className="text-xs text-muted-foreground font-body">{fallbackLabel}</span>
        <button
          type="button"
          onClick={handleManualRetry}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background border border-border text-[11px] font-body text-foreground hover:bg-accent hover:text-accent-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <RefreshCw className="h-3 w-3" aria-hidden />
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <img
        // key força o <img> a recriar quando attempt muda, garantindo
        // que o navegador refaça a request mesmo com mesma URL base.
        key={attempt}
        src={computedSrc}
        alt={alt}
        loading={loading}
        onLoad={handleLoad}
        onError={handleError}
        className="w-full h-full object-cover"
        {...imgProps}
      />
      {status === "loading" && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-muted/40 pointer-events-none"
          aria-hidden
        >
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
