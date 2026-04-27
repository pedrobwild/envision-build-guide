import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Identifica a versão do build atual para correlacionar telemetria
// (chunk_load_errors). Usa SHA do commit / id do deploy quando disponível,
// ou um timestamp como fallback. Disponível no client via
// `import.meta.env.VITE_APP_VERSION`.
const deployVersion =
  process.env.VITE_APP_VERSION ??
  process.env.LOVABLE_DEPLOY_ID ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.GIT_COMMIT_SHA ??
  process.env.COMMIT_REF ??
  new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(deployVersion),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Sobe o limite porque PDF/Map/cmdk são carregados sob demanda
    // (rotas/funções específicas), não no bundle inicial.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Separa libs pesadas em chunks dedicados — melhora cache entre deploys
        // e mantém o entry inicial enxuto (só vendors essenciais para a 1ª tela).
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "supabase": ["@supabase/supabase-js"],
          "tanstack-query": ["@tanstack/react-query"],
          "framer": ["framer-motion"],
          "radix-core": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-tabs",
          ],
        },
      },
    },
  },
}));

