import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard | NewsRoom',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
