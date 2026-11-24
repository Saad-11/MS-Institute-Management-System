/**
 * ErrorBoundary Component
 * 
 * Catches JavaScript errors in the React component tree and shows
 * a friendly error message instead of a blank screen or raw stack trace.
 */

import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log for developer debugging — not shown to users
    console.error('Application Error:', error);
    console.error('Component Stack:', errorInfo.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, errorMessage: '' });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'Segoe UI, sans-serif',
          backgroundColor: '#f0f2f5',
        }}>
          <div style={{
            background: 'white',
            padding: '3rem',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
            maxWidth: '500px',
            width: '100%',
          }}>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#1e293b' }}>
              Something went wrong
            </h1>
            <p style={{ color: '#64748b', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              The application encountered an unexpected error. Please try restarting.
              If the problem continues, contact support.
            </p>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Error: {this.state.errorMessage}
            </p>
            <button
              onClick={this.handleReload}
              style={{
                padding: '0.5rem 1.5rem',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.875rem',
                cursor: 'pointer',
                fontFamily: 'Segoe UI, sans-serif',
              }}
            >
              Restart Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
