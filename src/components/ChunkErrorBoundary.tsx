import React from "react";
import { reportChunkLoadError } from "@/lib/chunk-telemetry";

interface ChunkErrorBoundaryProps {
  children: React.ReactNode;
}

interface ChunkErrorBoundaryState {
  hasError: boolean;
}

/**
 * Captura falhas de chunk (módulos dinâmicos não encontrados após deploy) e
 * oferece um botão manual para recarregar. Não dispara reload automático para
 * evitar loops e telas de "Atualizando..." que confundem o cliente.
 */
export class ChunkErrorBoundary extends React.Component<
  ChunkErrorBoundaryProps,
  ChunkErrorBoundaryState
> {
  constructor(props: ChunkErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static isChunkError(error: Error) {
    return (
      error.message?.includes("Failed to fetch dynamically imported module") ||
      error.message?.includes("Loading chunk") ||
      error.message?.includes("Importing a module script failed") ||
      error.message?.includes("Unable to preload CSS") ||
      error.name === "ChunkLoadError"
    );
  }

  static getDerivedStateFromError(error: Error): Partial<ChunkErrorBoundaryState> {
    if (ChunkErrorBoundary.isChunkError(error)) {
      return { hasError: true };
    }
    // Não captura outros erros — deixa propagar para boundaries de página
    throw error;
  }

  componentDidCatch(error: Error) {
    if (ChunkErrorBoundary.isChunkError(error)) {
      void reportChunkLoadError({
        errorName: error.name,
        errorMessage: error.message,
        extraMetadata: { source: "ChunkErrorBoundary" },
      });
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground p-8">
          <p className="text-lg font-medium text-center">
            Uma nova versão do sistema está disponível.
          </p>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Clique abaixo para atualizar e continuar.
          </p>
          <button
            onClick={this.handleReload}
            className="px-6 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Atualizar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
