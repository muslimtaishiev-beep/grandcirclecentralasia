import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { isChunkLoadError, reloadForStaleBuild } from '../../lib/staleBuild';

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
    // Раздел не загрузился (новая выкатка) — перезагрузка лечит; если уже
    // пробовали минуту назад, остаёмся на экране ошибки, а не крутимся.
    if (isChunkLoadError(error)) reloadForStaleBuild();
  }

  private handleRetry = () => {
    // React запоминает неудачную загрузку раздела, повтор без перезагрузки
    // падал бы снова и снова.
    if (isChunkLoadError(this.state.error)) { window.location.reload(); return; }
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      const chunk = isChunkLoadError(this.state.error);
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
              {chunk
                ? 'Раздел не загрузился: сайт обновился или пропала связь. Проверьте интернет и обновите страницу.'
                : 'Произошла локальная ошибка в этом модуле. Остальная часть платформы продолжает работать исправно.'}
            </p>
          </div>
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" /> {chunk ? 'Обновить страницу' : 'Повторить попытку'}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
