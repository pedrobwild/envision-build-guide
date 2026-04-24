/**
 * Buffer circular para capturar os últimos N erros de console em runtime.
 * É inicializado uma única vez ao bootstrap e mantém uma janela rolante,
 * usada pelo BugReporter para anexar contexto técnico ao reportar um bug.
 *
 * Não substitui Sentry/observabilidade externa — é um auxiliar de UX
 * para que o usuário não precise abrir DevTools no celular.
 */

export interface CapturedConsoleEntry {
  level: "error" | "warn";
  message: string;
  timestamp: string;
  stack?: string;
}

const MAX_ENTRIES = 20;
const buffer: CapturedConsoleEntry[] = [];
let installed = false;

function pushEntry(entry: CapturedConsoleEntry) {
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) {
    buffer.splice(0, buffer.length - MAX_ENTRIES);
  }
}

function serializeArg(arg: unknown): string {
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  if (typeof arg === "string") return arg;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function findStack(args: unknown[]): string | undefined {
  for (const a of args) {
    if (a instanceof Error && a.stack) return a.stack.split("\n").slice(0, 8).join("\n");
  }
  return undefined;
}

export function installConsoleErrorBuffer() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalError = console.error.bind(console);
  const originalWarn = console.warn.bind(console);

  console.error = (...args: unknown[]) => {
    pushEntry({
      level: "error",
      message: args.map(serializeArg).join(" ").slice(0, 500),
      stack: findStack(args),
      timestamp: new Date().toISOString(),
    });
    originalError(...args);
  };

  console.warn = (...args: unknown[]) => {
    pushEntry({
      level: "warn",
      message: args.map(serializeArg).join(" ").slice(0, 500),
      timestamp: new Date().toISOString(),
    });
    originalWarn(...args);
  };

  window.addEventListener("error", (e) => {
    pushEntry({
      level: "error",
      message: `[window.error] ${e.message}`,
      stack: e.error?.stack?.split("\n").slice(0, 8).join("\n"),
      timestamp: new Date().toISOString(),
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason;
    pushEntry({
      level: "error",
      message: `[unhandledrejection] ${reason instanceof Error ? reason.message : String(reason)}`,
      stack: reason instanceof Error ? reason.stack?.split("\n").slice(0, 8).join("\n") : undefined,
      timestamp: new Date().toISOString(),
    });
  });
}

export function getCapturedConsoleEntries(): CapturedConsoleEntry[] {
  return [...buffer];
}

export function clearCapturedConsoleEntries() {
  buffer.length = 0;
}
