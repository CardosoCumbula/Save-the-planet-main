import React, { Component } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Catches any unhandled render error so the app shows a friendly message and a
// reload button instead of a blank white page.
class AppErrorBoundary extends Component<{ children: React.ReactNode }, { message: string | null }> {
  declare props: { children: React.ReactNode };
  declare state: { message: string | null };
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { message: null };
  }
  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : String(error) };
  }
  componentDidCatch(error: unknown) {
    console.error('AppErrorBoundary caught:', error);
  }
  render() {
    if (this.state.message) {
      return (
        <div style={{ padding: 32, fontFamily: 'sans-serif' }}>
          <h2>Something went wrong</h2>
          <p>The app hit an unexpected error. Please reload to try again.</p>
          <p style={{ color: '#888' }}>{this.state.message}</p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '8px 16px', marginTop: 12, cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);