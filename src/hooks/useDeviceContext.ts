import { useLocation } from "react-router-dom";
import { useUserProfile } from "@/hooks/useUserProfile";
import { getCapturedConsoleEntries } from "@/lib/console-error-buffer";

export interface DeviceContext {
  route: string;
  searchParams: Record<string, string>;
  userRole: string | null;
  deviceType: "mobile" | "tablet" | "desktop";
  osName: string;
  browserName: string;
  browserVersion: string;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  userAgent: string;
  activeFilters: Record<string, unknown>;
  consoleErrors: ReturnType<typeof getCapturedConsoleEntries>;
}

function detectBrowser(ua: string): { name: string; version: string } {
  const tests: Array<[string, RegExp]> = [
    ["Edge", /Edg\/([\d.]+)/],
    ["Chrome", /Chrome\/([\d.]+)/],
    ["Firefox", /Firefox\/([\d.]+)/],
    ["Safari", /Version\/([\d.]+).*Safari/],
    ["Opera", /OPR\/([\d.]+)/],
  ];
  for (const [name, re] of tests) {
    const m = ua.match(re);
    if (m) return { name, version: m[1] };
  }
  return { name: "Unknown", version: "" };
}

function detectOS(ua: string): string {
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Windows/.test(ua)) return "Windows";
  if (/Linux/.test(ua)) return "Linux";
  return "Unknown";
}

function detectDeviceType(width: number, ua: string): "mobile" | "tablet" | "desktop" {
  if (/iPad|Tablet/.test(ua) || (width >= 768 && width < 1024)) return "tablet";
  if (width < 768 || /Mobile|Android|iPhone/.test(ua)) return "mobile";
  return "desktop";
}

/**
 * Coleta o contexto técnico atual para anexar a um bug report.
 * Lê filtros ativos do localStorage usando uma convenção de prefixos
 * conhecidos (commercial-*, dashboard-*, crm-*) sem acoplamento direto.
 */
function collectActiveFilters(route: string): Record<string, unknown> {
  if (typeof localStorage === "undefined") return {};
  const out: Record<string, unknown> = {};
  const prefixes = ["commercial-", "dashboard-", "crm-", "estimator-", "agenda-"];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (prefixes.some((p) => key.startsWith(p))) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        out[key] = JSON.parse(raw);
      } catch {
        out[key] = raw.slice(0, 200);
      }
    }
  }
  out["__route_hint"] = route;
  return out;
}

export function useDeviceContext(): () => DeviceContext {
  const location = useLocation();
  const { profile } = useUserProfile();

  return () => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const width = typeof window !== "undefined" ? window.innerWidth : 0;
    const height = typeof window !== "undefined" ? window.innerHeight : 0;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;
    const browser = detectBrowser(ua);
    const searchParams: Record<string, string> = {};
    new URLSearchParams(location.search).forEach((v, k) => {
      searchParams[k] = v;
    });

    return {
      route: location.pathname,
      searchParams,
      userRole: profile?.roles?.[0] ?? null,
      deviceType: detectDeviceType(width, ua),
      osName: detectOS(ua),
      browserName: browser.name,
      browserVersion: browser.version,
      viewportWidth: width,
      viewportHeight: height,
      devicePixelRatio: dpr,
      userAgent: ua,
      activeFilters: collectActiveFilters(location.pathname),
      consoleErrors: getCapturedConsoleEntries(),
    };
  };
}
