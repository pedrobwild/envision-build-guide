import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";
import { formatBRL } from "@/lib/formatBRL";

interface CountUpValueProps {
  value: number;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function CountUpValue({ value, duration = 1.2, className, style }: CountUpValueProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  const [display, setDisplay] = useState(formatBRL(0));
  // Garantia de que o cliente nunca veja "R$ 0,00" preso quando a animação
  // não dispara — IntersectionObserver pode falhar no Safari mobile com
  // ancestrais transformados (motion.div com scale), em prefers-reduced-motion
  // ou com viewports baixas. Sem o fallback, o orçamento público mobile ficava
  // exibindo R$ 0,00 indefinidamente.
  const settledRef = useRef(false);

  useEffect(() => {
    const id = setTimeout(() => {
      if (settledRef.current) return;
      settledRef.current = true;
      setDisplay(formatBRL(value));
    }, 800);
    return () => clearTimeout(id);
  }, [value]);

  useEffect(() => {
    if (!isInView || settledRef.current) return;
    settledRef.current = true;

    const start = performance.now();

    function tick(now: number) {
      const progress = Math.min((now - start) / (duration * 1000), 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(formatBRL(eased * value));
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }, [isInView, value, duration]);

  return <span ref={ref} className={className} style={style}>{display}</span>;
}
