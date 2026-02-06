import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Calendar | NewsRoom',
};

export default function CalendarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
