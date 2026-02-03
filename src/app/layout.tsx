import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import AuthProvider from '@/components/layout/AuthProvider';
import { ThemeProvider } from '@/contexts/ThemeContext';
import CommandPalette from '@/components/ui/CommandPalette';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import './globals.css';
import './mobile.css';

export const metadata: Metadata = {
  title: 'NewsRoom',
  description: 'The digital newsroom for M3 Media writers and editors',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-paper-100 dark:bg-ink-950 transition-colors">
        <AuthProvider>
          <ThemeProvider>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
            <CommandPalette />
            <Toaster
              position="bottom-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#111c30',
                  color: '#f8f9fa',
                  borderRadius: '8px',
                  fontFamily: '"Source Sans 3", system-ui, sans-serif',
                  fontSize: '14px',
                },
                success: {
                  iconTheme: {
                    primary: '#D42B2B',
                    secondary: '#f8f9fa',
                  },
                },
              }}
            />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
