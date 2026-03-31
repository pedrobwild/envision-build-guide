import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigation, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Global top progress bar that activates on:
 * 1. Route transitions (via React Router)
 * 2. Fetch/XHR network requests (via monkey-patching fetch)
 */
export function GlobalLoadingBar() {
  const [activeRequests, setActiveRequests] = useState(0);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const location = useLocation();

  const increment = useCallback(() => {
    setActiveRequests((prev) => {
      const next = prev + 1;
      if (next === 1) {
        setVisible(true);
        setProgress(15);
      }
      return next;
    });
  }, []);

  const decrement = useCallback(() => {
    setActiveRequests((prev) => {
      const next = Math.max(0, prev - 1);
      if (next === 0) {
        setProgress(100);
        hideTimerRef.current = setTimeout(() => {
          setVisible(false);
          setProgress(0);
        }, 300);
      }
      return next;
    });
  }, []);

  // Intercept fetch
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const url = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url ?? "";
      // Only track supabase/edge-function calls, not static assets
      const isTracked =
        url.includes("supabase.co") || url.includes("/functions/");
      if (isTracked) increment();
      try {
        const response = await originalFetch(...args);
        if (isTracked) decrement();
        return response;
      } catch (err) {
        if (isTracked) decrement();
        throw err;
      }
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, [increment, decrement]);

  // Trickle progress while loading
  useEffect(() => {
    if (visible && progress < 90) {
      timerRef.current = setInterval(() => {
        setProgress((p) => {
          if (p >= 90) return p;
          const step = p < 50 ? 3 : p < 80 ? 1 : 0.5;
          return Math.min(p + step, 90);
        });
      }, 300);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [visible, progress]);

  // Route change flash
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [location.pathname]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed top-0 left-0 right-0 z-[100] h-[2.5px] pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="h-full bg-primary origin-left"
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          />
          <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-primary/40 to-transparent rounded-full" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
