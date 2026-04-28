/**
 * Cross-route deduplication for "auto-fork on edit of published version".
 *
 * Problem: when a user edits a published budget, every mutation (delete item,
 * update field, etc.) used to trigger a fresh `duplicateBudgetAsVersion()`,
 * because each fork-then-navigate cycle remounted the editor and reset the
 * in-memory `forkInProgress` ref. Result: 3+ versions per session.
 *
 * Solution: persist a small lock (and the resulting newId) in sessionStorage
 * keyed by the SOURCE published budget id. Subsequent attempts within a short
 * TTL reuse the same draft, regardless of remounts.
 */

const KEY = (sourceId: string) => `bwild:auto-fork-lock:${sourceId}`;
const TTL_MS = 60_000; // 1 minute is enough to cover the fork + navigate cycle

interface LockState {
  status: "pending" | "ready";
  newId?: string;
  ts: number;
}

function read(sourceId: string): LockState | null {
  try {
    const raw = sessionStorage.getItem(KEY(sourceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LockState;
    if (Date.now() - parsed.ts > TTL_MS) {
      sessionStorage.removeItem(KEY(sourceId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function write(sourceId: string, state: LockState) {
  try {
    sessionStorage.setItem(KEY(sourceId), JSON.stringify(state));
  } catch {
    /* storage may be unavailable; degrade gracefully */
  }
}

/** True if a fork for this source is already pending or finished recently. */
export function hasActiveForkFor(sourceId: string): LockState | null {
  return read(sourceId);
}

/** Mark that a fork is starting; returns false if another caller already started. */
export function tryAcquireForkLock(sourceId: string): boolean {
  const existing = read(sourceId);
  if (existing) return false;
  write(sourceId, { status: "pending", ts: Date.now() });
  return true;
}

/** Record the resulting draft id so concurrent callers can reuse it. */
export function completeForkLock(sourceId: string, newId: string) {
  write(sourceId, { status: "ready", newId, ts: Date.now() });
}

/** Clear the lock — call after navigation succeeds or on failure. */
export function releaseForkLock(sourceId: string) {
  try {
    sessionStorage.removeItem(KEY(sourceId));
  } catch {
    /* ignore */
  }
}
