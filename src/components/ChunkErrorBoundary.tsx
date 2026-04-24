import React from "react";
import { hardReloadWithCacheBust, wasJustCacheBusted } from "@/lib/cache-bust";

interface ChunkErrorBoundaryProps {
  children: React.ReactNode;
}

interface ChunkErrorBoundaryState {
  hasError: boolean;
  reloading: boolean;
}

export class ChunkErrorBoundary extends React.Component<
  ChunkErrorBoundaryProps,
  ChunkErrorBoundaryState
> {
  constructor(props: ChunkErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, reloading: false };
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
    return { hasError: ChunkErrorBoundary.isChunkError(error) };
  }

  componentDidMount() {
    window.addEventListener("chunk-load-error", this.handleChunkError);

    // Auto-recovery: se o boundary já caiu (ex.: chunk 404 após deploy) e
    // ainda não tentamos um reload com cache-bust, tenta automaticamente.
    if (this.state.hasError && !wasJustCacheBusted()) {
      this.triggerHardReload();
    }
  }

  componentWillUnmount() {
    window.removeEventListener("chunk-load-error", this.handleChunkError);
  }

  handleChunkError = () => {
    this.setState({ hasError: true });
    if (!wasJustCacheBusted()) {
      this.triggerHardReload();
    }
  };

  triggerHardReload = () => {
    if (this.state.reloading) return;
    this.setState({ reloading: true });
    void hardReloadWithCacheBust();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground p-8">
          <p className="text-lg font-medium text-center">
            {this.state.reloading
              ? "Atualizando para a versão mais recente..."
              : "Uma nova versão do sistema está disponível."}
          </p>
          <p className="text-sm text-muted-foreground text-center">
            {this.state.reloading
              ? "Aguarde só um instante."
              : "Clique abaixo para atualizar sem perder sua sessão."}
          </p>
          {!this.state.reloading && (
            <button
              onClick={this.triggerHardReload}
              className="px-6 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Atualizar agora
            </button>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
