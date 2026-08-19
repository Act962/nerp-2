import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Um PDV NUNCA pode mostrar tela em branco. Se algum render falhar, este boundary
 * mostra uma mensagem com "Recarregar" (o estado — caixa/fila — está persistido
 * em SQLite, então recarregar é seguro) em vez de sumir, e loga o erro.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Erro de render no PDV:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="screen center">
          <div className="card login-card">
            <h1 className="brand">Algo deu errado</h1>
            <p className="muted small">{this.state.error.message}</p>
            <button
              type="button"
              className="btn primary"
              onClick={() => window.location.reload()}
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
