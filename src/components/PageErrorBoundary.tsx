import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: React.ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * General-purpose error boundary for page-level components.
 * Catches render errors in children and displays a friendly retry UI.
 */
export class PageErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[PageErrorBoundary]", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 p-8 min-h-[300px]">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <h2 className="text-lg font-display font-semibold text-foreground">
            Algo deu errado
          </h2>
          <p className="text-sm text-muted-foreground text-center max-w-md font-body">
            {this.props.fallbackMessage || "Ocorreu um erro inesperado. Tente novamente."}
          </p>
          {import.meta.env.DEV && this.state.error && (
            <pre className="text-xs text-destructive/70 bg-destructive/5 rounded-lg p-3 max-w-lg overflow-auto">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
