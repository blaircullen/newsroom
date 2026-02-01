import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import AuthProvider from '@/components/layout/AuthProvider';
import './globals.css';

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
    <html lang="en">
      <body className="min-h-screen">
        <AuthProvider>
          {children}
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
        </AuthProvider>
      </body>
    </html>
  );
}
