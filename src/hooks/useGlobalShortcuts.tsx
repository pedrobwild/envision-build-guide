import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

/**
 * Atalhos globais de teclado, estilo Linear/Pipedrive.
 * Sequência: pressione G e então a tecla destino (não simultaneamente).
 *
 * - G então D → Painel Geral
 * - G então C → Pipeline Comercial
 * - G então P → Pipeline Orçamentos (Produção)
 * - G então A → Agenda
 * - G então L → Clientes (CRM)
 * - N → Novo negócio (solicitação)
 * - ? → Mostra lista de atalhos via toast
 *
 * Cmd/Ctrl+K (paleta de comandos) é tratado em CommandPalette.
 */
export function useGlobalShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    let waitingForSecond = false;
    let resetTimer: ReturnType<typeof setTimeout> | null = null;

    const reset = () => {
      waitingForSecond = false;
      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = null;
    };

    const isTypingTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (target.isContentEditable) return true;
      // Ignore inside dialogs that capture typing (e.g. cmdk)
      if (target.closest("[role='combobox']")) return true;
      return false;
    };

    const handler = (e: KeyboardEvent) => {
      // Skip if typing
      if (isTypingTarget(e.target)) return;
      // Skip if modifiers (those are handled elsewhere)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      // Help
      if (key === "?" || (e.shiftKey && key === "/")) {
        e.preventDefault();
        toast("Atalhos de teclado", {
          description:
            "G→D Painel · G→C Comercial · G→P Produção · G→A Agenda · G→L Clientes · N Novo negócio · ⌘K Buscar",
          duration: 6000,
        });
        return;
      }

      // Single-key actions
      if (!waitingForSecond) {
        if (key === "n") {
          e.preventDefault();
          navigate("/admin/solicitacoes/nova");
          return;
        }
        if (key === "g") {
          e.preventDefault();
          waitingForSecond = true;
          resetTimer = setTimeout(reset, 1500);
          return;
        }
        return;
      }

      // Second key after G
      e.preventDefault();
      reset();
      switch (key) {
        case "d":
          navigate("/admin");
          break;
        case "c":
          navigate("/admin/comercial");
          break;
        case "p":
          navigate("/admin/producao");
          break;
        case "a":
          navigate("/admin/agenda");
          break;
        case "l":
          navigate("/admin/crm");
          break;
        default:
          // unknown — silent
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (resetTimer) clearTimeout(resetTimer);
    };
  }, [navigate]);
}
