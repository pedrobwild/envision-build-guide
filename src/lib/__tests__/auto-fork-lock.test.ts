import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  hasActiveForkFor,
  tryAcquireForkLock,
  completeForkLock,
  releaseForkLock,
} from "../auto-fork-lock";

beforeEach(() => {
  sessionStorage.clear();
  vi.useRealTimers();
});

afterEach(() => {
  sessionStorage.clear();
});

describe("auto-fork-lock", () => {
  describe("tryAcquireForkLock", () => {
    it("retorna true na primeira tentativa", () => {
      expect(tryAcquireForkLock("budget-123")).toBe(true);
    });

    it("retorna false se outro caller já adquiriu", () => {
      tryAcquireForkLock("budget-123");
      expect(tryAcquireForkLock("budget-123")).toBe(false);
    });

    it("locks são independentes por sourceId", () => {
      tryAcquireForkLock("budget-123");
      expect(tryAcquireForkLock("budget-456")).toBe(true);
    });
  });

  describe("hasActiveForkFor", () => {
    it("retorna null quando não há lock", () => {
      expect(hasActiveForkFor("budget-x")).toBeNull();
    });

    it("retorna estado pending após acquire", () => {
      tryAcquireForkLock("budget-x");
      const state = hasActiveForkFor("budget-x");
      expect(state?.status).toBe("pending");
    });

    it("retorna estado ready após complete", () => {
      tryAcquireForkLock("budget-x");
      completeForkLock("budget-x", "draft-999");
      const state = hasActiveForkFor("budget-x");
      expect(state?.status).toBe("ready");
      expect(state?.newId).toBe("draft-999");
    });
  });

  describe("TTL", () => {
    it("expira lock após 60s", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      tryAcquireForkLock("budget-ttl");
      expect(hasActiveForkFor("budget-ttl")).not.toBeNull();

      vi.setSystemTime(new Date("2026-01-01T00:01:01Z"));
      expect(hasActiveForkFor("budget-ttl")).toBeNull();
    });

    it("após expirar, novo acquire funciona", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      tryAcquireForkLock("budget-ttl2");

      vi.setSystemTime(new Date("2026-01-01T00:02:00Z"));
      expect(tryAcquireForkLock("budget-ttl2")).toBe(true);
    });
  });

  describe("releaseForkLock", () => {
    it("remove o lock", () => {
      tryAcquireForkLock("budget-r");
      releaseForkLock("budget-r");
      expect(hasActiveForkFor("budget-r")).toBeNull();
    });

    it("permite re-acquire após release", () => {
      tryAcquireForkLock("budget-r2");
      releaseForkLock("budget-r2");
      expect(tryAcquireForkLock("budget-r2")).toBe(true);
    });
  });

  describe("robustez", () => {
    it("ignora JSON corrompido em sessionStorage e trata como sem lock", () => {
      sessionStorage.setItem("bwild:auto-fork-lock:budget-bad", "not-json{{");
      expect(hasActiveForkFor("budget-bad")).toBeNull();
      expect(tryAcquireForkLock("budget-bad")).toBe(true);
    });
  });
});
