import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackLabel?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-card border border-red-500/30 rounded-2xl p-8 space-y-5 shadow-xl text-center">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-red-400" />
              </div>
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-red-400">Ocorreu um erro inesperado</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {this.props.fallbackLabel ??
                  "Um problema técnico impediu a exibição desta página. Recarregue para continuar."}
              </p>
            </div>
            {this.state.error && (
              <details className="text-left text-[11px] text-muted-foreground/60 border border-border/40 rounded-lg p-3 cursor-pointer">
                <summary className="font-medium cursor-pointer select-none">Detalhes técnicos</summary>
                <pre className="mt-2 whitespace-pre-wrap break-words">{this.state.error.message}</pre>
              </details>
            )}
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Recarregar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
