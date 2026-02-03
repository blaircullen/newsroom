'use client';

import { Component, ReactNode } from 'react';
import { HiOutlineExclamationTriangle, HiOutlineArrowPath } from 'react-icons/hi2';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
              <HiOutlineExclamationTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="font-display text-xl font-semibold text-ink-900 dark:text-ink-100 mb-2">
              Something went wrong
            </h2>
            <p className="text-ink-500 dark:text-ink-400 text-sm mb-6">
              An unexpected error occurred. Please try again or contact support if the problem persists.
            </p>
            {this.state.error && (
              <details className="mb-6 text-left">
                <summary className="text-xs text-ink-400 cursor-pointer hover:text-ink-600 dark:hover:text-ink-300">
                  View error details
                </summary>
                <pre className="mt-2 p-3 bg-ink-50 dark:bg-ink-800 rounded-lg text-xs text-ink-600 dark:text-ink-300 overflow-x-auto">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-ink-950 dark:bg-ink-100 text-white dark:text-ink-900 rounded-lg font-medium text-sm hover:bg-ink-800 dark:hover:bg-ink-200 transition-colors focus:outline-none focus:ring-2 focus:ring-press-500 focus:ring-offset-2"
            >
              <HiOutlineArrowPath className="w-4 h-4" />
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
