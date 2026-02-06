import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Social Queue | NewsRoom',
};

export default function SocialQueueLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
