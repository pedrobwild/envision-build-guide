import React from "react";

interface ChunkErrorBoundaryProps {
  children: React.ReactNode;
}

interface ChunkErrorBoundaryState {
  hasError: boolean;
}

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
      error.name === "ChunkLoadError"
    );
  }

  static getDerivedStateFromError(error: Error): ChunkErrorBoundaryState {
    return { hasError: ChunkErrorBoundary.isChunkError(error) };
  }

  componentDidMount() {
    window.addEventListener("chunk-load-error", this.handleChunkError);
  }

  componentWillUnmount() {
    window.removeEventListener("chunk-load-error", this.handleChunkError);
  }

  handleChunkError = () => {
    this.setState({ hasError: true });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground p-8">
          <p className="text-lg font-medium text-center">
            Uma nova versão do sistema está disponível.
          </p>
          <p className="text-sm text-muted-foreground text-center">
            Clique abaixo para atualizar sem perder sua sessão.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Atualizar agora
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
