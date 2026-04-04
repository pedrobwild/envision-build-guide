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

  useEffect(() => {
    if (!isInView) return;

    const start = performance.now();
    const end = start + duration * 1000;

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
