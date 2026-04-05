import React from 'react';

type AppErrorBoundaryState = {
  hasError: boolean;
  errorMessage: string;
  errorStack: string;
};

export default class AppErrorBoundary extends React.Component<
  React.PropsWithChildren,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
    errorStack: '',
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Se ha producido un error inesperado.',
      errorStack: error?.stack || '',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App runtime error', error, errorInfo);
  }

  handleReload = () => {
    if ("caches" in window) {
      caches.keys()
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .catch(() => undefined)
        .finally(() => window.location.reload());
      return;
    }

    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
          <div className="max-w-xl w-full rounded-2xl border border-border bg-card shadow-sm p-6 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-destructive">
                Runtime Error
              </p>
              <h1 className="text-2xl font-semibold mt-2">
                La app ha fallado al renderizar esta pantalla
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Ya no debería quedarse en blanco. Si vuelve a pasar, este mensaje nos ayudará a detectar el fallo real.
            </p>
            <div className="rounded-lg bg-muted p-3 text-sm font-mono break-words">
              {this.state.errorMessage}
            </div>
            <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground space-y-1">
              <div><strong>Ruta:</strong> {window.location.pathname}</div>
              {this.state.errorStack && (
                <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-5">
                  {this.state.errorStack}
                </pre>
              )}
            </div>
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Recargar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
