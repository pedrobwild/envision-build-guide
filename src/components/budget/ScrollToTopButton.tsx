import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp } from "lucide-react";

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > window.innerHeight * 3);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          onClick={() => {
            if (navigator.vibrate) navigator.vibrate(10);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="budget-focus-cta fixed bottom-20 left-4 lg:bottom-6 z-40 p-2.5 rounded-full bg-muted/80 backdrop-blur-sm border border-border/60 text-muted-foreground shadow-md hover:shadow-lg hover:bg-muted active:bg-muted/90"
          aria-label="Voltar ao topo"
          data-pdf-hide
        >
          <ChevronUp className="h-4 w-4" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
