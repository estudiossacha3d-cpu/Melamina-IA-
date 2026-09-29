import {StrictMode, Component, ErrorInfo, ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class GlobalErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Application error caught by GlobalErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#1f1f1f',
          color: '#e0e0e0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            maxWidth: '420px',
            backgroundColor: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: '16px',
            padding: '24px',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>
              Reanudando Aplicación
            </h2>
            <p style={{ fontSize: '13px', color: '#aaa', marginBottom: '20px', lineHeight: 1.5 }}>
              La memoria del dispositivo se saturó temporalmente al cambiar de pantalla o navegador. Pulsa el botón para recargar.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: '#f0a144',
                color: '#111',
                fontWeight: 'bold',
                fontSize: '13px',
                padding: '10px 20px',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Recargar Aplicación
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </StrictMode>,
);

