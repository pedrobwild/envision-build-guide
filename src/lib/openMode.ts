/**
 * Preferência do usuário para o modo de abertura do orçamento público.
 *
 * - `new_tab`  → sempre `window.open` em nova aba (comportamento histórico).
 * - `same_tab` → navega na própria aba via `window.location.assign` (sem popup).
 * - `auto`     → tenta nova aba; se o navegador bloquear, navega na mesma aba
 *                e mostra um toast informando o usuário.
 *
 * A preferência é persistida em localStorage e exposta via hook reativo.
 */
import { useSyncExternalStore } from "react";

export type OpenMode = "new_tab" | "same_tab" | "auto";

const STORAGE_KEY = "bwild:openPublicBudgetMode";
const DEFAULT_MODE: OpenMode = "auto";

const VALID = new Set<OpenMode>(["new_tab", "same_tab", "auto"]);

function readMode(): OpenMode {
  if (typeof window === "undefined") return DEFAULT_MODE;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v && VALID.has(v as OpenMode) ? (v as OpenMode) : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

const listeners = new Set<() => void>();

export function getOpenMode(): OpenMode {
  return readMode();
}

export function setOpenMode(mode: OpenMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore quota / privacy errors */
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) fn();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

export function useOpenMode(): [OpenMode, (m: OpenMode) => void] {
  const mode = useSyncExternalStore(subscribe, readMode, () => DEFAULT_MODE);
  return [mode, setOpenMode];
}

export const OPEN_MODE_LABELS: Record<OpenMode, string> = {
  new_tab: "Sempre em nova aba",
  same_tab: "Sempre na mesma aba",
  auto: "Automático (nova aba; mesma aba se bloqueada)",
};
