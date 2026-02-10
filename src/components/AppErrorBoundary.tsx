import React from 'react';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
};

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : 'Error inesperado en la interfaz';
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown) {
    console.error('Unhandled UI error:', error);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="h-screen w-screen bg-dark-900 text-white flex items-center justify-center p-6">
        <div className="max-w-xl w-full glass-card p-6">
          <h1 className="text-lg font-semibold text-red-300">Error de interfaz</h1>
          <p className="text-sm text-white/70 mt-2">
            La aplicacion encontro un error inesperado. Reinicia la ventana para recuperar el estado.
          </p>
          <pre className="mt-4 p-3 rounded bg-dark-800 text-xs text-red-200 whitespace-pre-wrap break-words">
            {this.state.message}
          </pre>
        </div>
      </div>
    );
  }
}

