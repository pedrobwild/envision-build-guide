import React from "react";
import { PublicBudgetFallback } from "./PublicBudgetFallback";
import type { BudgetData } from "@/types/budget";

interface Props {
  budget: BudgetData;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Captura falhas de render do orçamento público (cards, mapas, imagens, lazy chunks)
 * e mostra um resumo essencial em vez de tela branca.
 *
 * IMPORTANTE: precisa receber `budget` por props porque, dentro de getDerivedStateFromError,
 * não temos acesso ao contexto/hook. Assim conseguimos exibir cliente, data e total final
 * mesmo quando o JSX principal falha.
 */
export class PublicBudgetErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log estruturado para diagnóstico (não polui o usuário final)
    console.error("[PublicBudgetErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <PublicBudgetFallback
          budget={this.props.budget}
          errorMessage={this.state.error?.message}
        />
      );
    }
    return this.props.children;
  }
}
