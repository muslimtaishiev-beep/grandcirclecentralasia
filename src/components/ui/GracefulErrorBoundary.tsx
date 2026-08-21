import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GracefulErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[GracefulErrorBoundary] Uncaught component error:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-2xl border border-red-500/30 bg-red-500/5 backdrop-blur-md flex flex-col items-center justify-center text-center space-y-3 my-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base text-[var(--text-main)]">
              {this.props.fallbackTitle || 'Ошибка загрузки блока'}
            </h3>
            <p className="text-xs text-[var(--text-muted)] max-w-md mt-1">
              Произошла локальная ошибка в этом модуле. Остальная часть платформы продолжают работать исправно.
            </p>
          </div>
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Повторить попытку
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
