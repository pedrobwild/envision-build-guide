import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import App from "./App.tsx";
import "./index.css";
import { installConsoleErrorBuffer } from "./lib/console-error-buffer";
import { installChunkErrorTelemetry } from "./lib/chunk-telemetry";
import { installAuthFetchRetry } from "./lib/auth-fetch-retry";
import { installAuthSessionRecovery } from "./lib/auth-session-recovery";
import { installOpenBudgetSink } from "./lib/openBudgetSink";

// Retry automático para refresh_token do Supabase em erros de rede
// ("Failed to fetch"), com aviso visível ao usuário. Deve rodar antes
// de qualquer import que crie cliente Supabase.
installAuthFetchRetry();

// Recupera silenciosamente a sessão (refreshSession) quando a rede volta
// após uma falha definitiva de refresh_token, evitando reload da página.
installAuthSessionRecovery();

// Captura erros de runtime numa janela rolante para o BugReporter anexar
// contexto técnico mesmo em mobile (sem precisar abrir o DevTools).
installConsoleErrorBuffer();

// Telemetria silenciosa de falhas de carregamento de chunks (lazy imports).
// Captura tanto erros que escapam para `unhandledrejection`/`window.error`
// quanto os capturados pelo `ChunkErrorBoundary`. Correlaciona com
// `public_id` (rota pública) e `VITE_APP_VERSION` (versão do deploy).
installChunkErrorTelemetry();

// Envia cada evento de abertura do orçamento público para
// `public.open_budget_telemetry` com correlation_id por sessão e event_id
// único — permite diagnosticar relatos de "não abriu" pelo backend.
installOpenBudgetSink();

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <App />
  </ThemeProvider>
);

