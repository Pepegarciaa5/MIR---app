import React from 'react';

/**
 * ErrorBoundary genérico para proteger la interfaz de React contra pantallas blancas.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary capturó un error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="p-4 my-2 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
          <div className="font-bold mb-1 flex items-center gap-1.5">
            <span>⚠️</span> Error al mostrar este contenido
          </div>
          <p className="text-xs text-red-600 mb-2 font-mono">
            {this.state.error?.message || 'Error inesperado'}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-2.5 py-1 rounded bg-red-100 hover:bg-red-200 text-red-900 text-xs font-semibold transition-colors"
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
