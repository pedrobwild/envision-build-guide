import { useEffect, useState } from "react";
import { motion, useSpring } from "framer-motion";

export function ReadingProgressBar() {
  const [progress, setProgress] = useState(0);
  const smoothProgress = useSpring(0, { stiffness: 100, damping: 30 });

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0;
      setProgress(pct);
      smoothProgress.set(pct);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [smoothProgress]);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-[3px] bg-transparent pointer-events-none">
      <motion.div
        className="h-full bg-primary origin-left"
        style={{ scaleX: smoothProgress }}
      />
    </div>
  );
}
