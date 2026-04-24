import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import App from "./App.tsx";
import "./index.css";
import { installConsoleErrorBuffer } from "./lib/console-error-buffer";
import { initPublicBudgetCacheGuard } from "./lib/cache-bust";

// Captura erros de runtime numa janela rolante para o BugReporter anexar
// contexto técnico mesmo em mobile (sem precisar abrir o DevTools).
installConsoleErrorBuffer();

// Em rotas públicas (/o/:publicId, /obra/...), garante que nenhum service worker
// legado ou cache obsoleto interfira no carregamento do orçamento.
initPublicBudgetCacheGuard();

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <App />
  </ThemeProvider>
);
