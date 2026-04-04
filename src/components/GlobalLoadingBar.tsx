import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";

/**
 * Global top progress bar that activates on
 * Fetch/XHR network requests to Supabase/edge-functions.
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

  // Cleanup hide timer on unmount / route change
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [location.pathname]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] h-[2.5px] pointer-events-none"
      role="progressbar"
      aria-valuenow={Math.round(progress)}
    >
      <div
        className="h-full bg-primary origin-left transition-all duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
      <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-primary/40 to-transparent rounded-full" />
    </div>
  );
}
