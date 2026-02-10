import React from 'react';

type Props = {
  children: React.ReactNode;
  onRecover?: () => void;
};

type State = {
  hasError: boolean;
};

export class ViewErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('View rendering error:', error);
  }

  private handleRecover = () => {
    this.setState({ hasError: false });
    this.props.onRecover?.();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-white/85 font-medium">Se produjo un error en esta vista.</p>
        <p className="text-white/50 text-sm">
          Puedes volver al panel principal sin cerrar la aplicacion.
        </p>
        <button
          type="button"
          onClick={this.handleRecover}
          className="px-4 py-2 rounded-lg bg-white/12 hover:bg-white/20 text-sm text-white transition-colors"
        >
          Volver al dashboard
        </button>
      </div>
    );
  }
}
