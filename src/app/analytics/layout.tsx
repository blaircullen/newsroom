import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Analytics | NewsRoom',
};

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
