import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import App from "./App.tsx";
import "./index.css";
import { installConsoleErrorBuffer } from "./lib/console-error-buffer";

// Captura erros de runtime numa janela rolante para o BugReporter anexar
// contexto técnico mesmo em mobile (sem precisar abrir o DevTools).
installConsoleErrorBuffer();

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <App />
  </ThemeProvider>
);
