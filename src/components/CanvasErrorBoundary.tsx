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

export default class CanvasErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('WebGL / Canvas render error:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#252525] text-gray-200 p-6 z-20 select-none">
          <div className="bg-[#1a1a1a] border border-[#3a3a3a] rounded-2xl p-6 max-w-sm w-full flex flex-col items-center text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">
              {this.props.fallbackTitle || 'Aceleración Gráfica (3D)'}
            </h3>
            <p className="text-xs text-gray-400 mb-4 leading-relaxed">
              El navegador móvil pausó el motor 3D para ahorrar memoria. Puedes reintentar la carga con optimización móvil.
            </p>
            <button
              type="button"
              onClick={this.handleRetry}
              className="flex items-center gap-2 bg-[#f0a144] hover:bg-[#f2b05e] text-black text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reintentar Carga 3D
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
