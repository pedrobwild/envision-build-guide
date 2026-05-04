/**
 * Anti-regressão para o wrapper de retry do fetch de auth.
 *
 * O módulo guarda estado em variáveis no escopo do arquivo (`installed`,
 * `failureBuffer`, `retryState`). Para testar `installAuthFetchRetry`
 * isoladamente, cada bloco usa `vi.resetModules()` + re-import dinâmico,
 * de forma que o fetch global e os flags voltam ao estado limpo.
 */
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type MockInstance,
} from "vitest";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

let originalFetch: typeof window.fetch;

beforeEach(() => {
  originalFetch = window.fetch;
  vi.resetModules();
});

afterEach(() => {
  window.fetch = originalFetch;
  vi.useRealTimers();
});

describe("AUTH_RETRY_CONFIG / setAuthRetryConfig", () => {
  it("expõe defaults sensatos", async () => {
    const mod = await import("@/lib/auth-fetch-retry");
    expect(mod.AUTH_RETRY_CONFIG.maxRetries).toBeGreaterThanOrEqual(0);
    expect(mod.AUTH_RETRY_CONFIG.baseDelayMs).toBeGreaterThan(0);
    expect(mod.AUTH_RETRY_CONFIG.backoffFactor).toBeGreaterThanOrEqual(1);
    expect(mod.AUTH_RETRY_CONFIG.maxDelayMs).toBeGreaterThan(0);
  });

  it("setAuthRetryConfig faz merge parcial", async () => {
    const mod = await import("@/lib/auth-fetch-retry");
    const before = { ...mod.AUTH_RETRY_CONFIG };
    mod.setAuthRetryConfig({ maxRetries: 7 });
    expect(mod.AUTH_RETRY_CONFIG.maxRetries).toBe(7);
    expect(mod.AUTH_RETRY_CONFIG.baseDelayMs).toBe(before.baseDelayMs);
  });
});

describe("buffer de falhas", () => {
  it("começa vazio e clearAuthRefreshFailures limpa", async () => {
    const mod = await import("@/lib/auth-fetch-retry");
    expect(mod.getAuthRefreshFailures()).toEqual([]);
    mod.clearAuthRefreshFailures();
    expect(mod.getAuthRefreshFailures()).toEqual([]);
  });

  it("getAuthRefreshFailures retorna cópia (imutável)", async () => {
    const mod = await import("@/lib/auth-fetch-retry");
    const a = mod.getAuthRefreshFailures();
    const b = mod.getAuthRefreshFailures();
    expect(a).not.toBe(b);
  });
});

describe("estado de reconexão", () => {
  it("getAuthRetryState retorna estado inicial neutro", async () => {
    const mod = await import("@/lib/auth-fetch-retry");
    const s = mod.getAuthRetryState();
    expect(s.reconnecting).toBe(false);
    expect(s.attempt).toBe(0);
    expect(s.reason).toBeNull();
  });

  it("subscribe retorna unsubscribe", async () => {
    const mod = await import("@/lib/auth-fetch-retry");
    const fn = vi.fn();
    const unsub = mod.subscribeAuthRetryState(fn);
    expect(typeof unsub).toBe("function");
    unsub();
  });
});

describe("installAuthFetchRetry — passthrough e retries", () => {
  it("não-auth URL passa direto para o fetch original", async () => {
    const mockOriginal = vi.fn().mockResolvedValue(new Response("ok"));
    window.fetch = mockOriginal as unknown as typeof window.fetch;

    const mod = await import("@/lib/auth-fetch-retry");
    mod.installAuthFetchRetry();

    const res = await window.fetch("https://example.com/api/data");
    expect(res).toBeInstanceOf(Response);
    expect(mockOriginal).toHaveBeenCalledTimes(1);
  });

  it("é idempotente: chamar duas vezes não embrulha o fetch novamente", async () => {
    const mockOriginal = vi.fn().mockResolvedValue(new Response("ok"));
    window.fetch = mockOriginal as unknown as typeof window.fetch;

    const mod = await import("@/lib/auth-fetch-retry");
    mod.installAuthFetchRetry();
    const wrapped = window.fetch;
    mod.installAuthFetchRetry();
    expect(window.fetch).toBe(wrapped);
  });

  it("URL de auth com sucesso retorna a resposta", async () => {
    const mockOriginal = vi.fn().mockResolvedValue(new Response("{}"));
    window.fetch = mockOriginal as unknown as typeof window.fetch;

    const mod = await import("@/lib/auth-fetch-retry");
    mod.installAuthFetchRetry();

    const res = await window.fetch("https://x.supabase.co/auth/v1/token?grant_type=refresh_token");
    expect(res.status).toBe(200);
    expect(mockOriginal).toHaveBeenCalledTimes(1);
  });

  it("erro de rede em URL de auth dispara retry e eventualmente sucesso", async () => {
    const mockOriginal = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue(new Response("{}"));
    window.fetch = mockOriginal as unknown as typeof window.fetch;

    const mod = await import("@/lib/auth-fetch-retry");
    mod.setAuthRetryConfig({ baseDelayMs: 1, backoffFactor: 1, maxDelayMs: 1, maxRetries: 3 });
    mod.installAuthFetchRetry();

    const res = await window.fetch("https://x.supabase.co/auth/v1/token?grant_type=refresh_token");
    expect(res).toBeInstanceOf(Response);
    expect(mockOriginal).toHaveBeenCalledTimes(2);
  });

  it("erro NÃO de rede não retenta", async () => {
    const mockOriginal = vi
      .fn()
      .mockRejectedValue(new Error("Boom internal"));
    window.fetch = mockOriginal as unknown as typeof window.fetch;

    const mod = await import("@/lib/auth-fetch-retry");
    mod.setAuthRetryConfig({ baseDelayMs: 1, backoffFactor: 1, maxDelayMs: 1, maxRetries: 3 });
    mod.installAuthFetchRetry();

    await expect(
      window.fetch("https://x.supabase.co/auth/v1/token?grant_type=refresh_token"),
    ).rejects.toThrow(/boom/i);
    // 1 chamada — sem retry
    expect(mockOriginal).toHaveBeenCalledTimes(1);
  });

  it("buffer de falhas registra a tentativa com URL redigida (sem query)", async () => {
    const mockOriginal = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue(new Response("{}"));
    window.fetch = mockOriginal as unknown as typeof window.fetch;

    const mod = await import("@/lib/auth-fetch-retry");
    mod.setAuthRetryConfig({ baseDelayMs: 1, backoffFactor: 1, maxDelayMs: 1, maxRetries: 3 });
    mod.installAuthFetchRetry();

    await window.fetch(
      "https://x.supabase.co/auth/v1/token?grant_type=refresh_token&refresh_token=SECRET",
    );

    const failures = mod.getAuthRefreshFailures();
    expect(failures.length).toBeGreaterThanOrEqual(1);
    const last = failures[failures.length - 1];
    expect(last.url).not.toContain("SECRET");
    expect(last.url).not.toContain("refresh_token");
    expect(last.errorName).toBe("TypeError");
  });

  it("após esgotar retries em erro de rede, lança o erro", async () => {
    const networkErr = new TypeError("Failed to fetch");
    const mockOriginal = vi.fn().mockRejectedValue(networkErr);
    window.fetch = mockOriginal as unknown as typeof window.fetch;

    const mod = await import("@/lib/auth-fetch-retry");
    mod.setAuthRetryConfig({ baseDelayMs: 1, backoffFactor: 1, maxDelayMs: 1, maxRetries: 2 });
    mod.installAuthFetchRetry();

    await expect(
      window.fetch("https://x.supabase.co/auth/v1/token"),
    ).rejects.toThrow(/failed to fetch/i);
    // 2 retries + 1 inicial = 3
    expect(mockOriginal).toHaveBeenCalledTimes(3);
  });
});

describe("comportamento offline (navigator.onLine)", () => {
  let onLineSpy: MockInstance | undefined;

  afterEach(() => {
    onLineSpy?.mockRestore();
  });

  it("se offline e timeout do waitForOnline ocorre, encerra o ciclo sem fetch", async () => {
    onLineSpy = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const mockOriginal = vi.fn().mockResolvedValue(new Response("{}"));
    window.fetch = mockOriginal as unknown as typeof window.fetch;

    const mod = await import("@/lib/auth-fetch-retry");
    // Reduz tempos para o teste rodar rápido
    mod.setAuthRetryConfig({ baseDelayMs: 1, backoffFactor: 1, maxDelayMs: 1, maxRetries: 0 });
    mod.installAuthFetchRetry();

    // Forçamos fake timers só dentro deste fluxo para acelerar o waitForOnline
    vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 1 });
    const promise = window.fetch("https://x.supabase.co/auth/v1/token");
    // Pré-anexa catch para evitar warning de unhandled-rejection enquanto
    // os fake timers avançam.
    promise.catch(() => {});
    // Avança além do OFFLINE_WAIT_TIMEOUT_MS (60s)
    await vi.advanceTimersByTimeAsync(61_000);

    await expect(promise).rejects.toThrow();
    // Como ficou offline e timeout, não chamou o fetch original.
    expect(mockOriginal).not.toHaveBeenCalled();

    // O buffer registra "offline-timeout"
    const failures = mod.getAuthRefreshFailures();
    expect(failures.some((f) => f.phase === "offline-timeout")).toBe(true);
  });
});
