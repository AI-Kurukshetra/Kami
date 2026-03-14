import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { TopNavLinks } from '@/components/top-nav-links';
import { ToastViewport } from '@/components/toast-viewport';

export const metadata: Metadata = {
  title: 'Kami MVP',
  description: 'Next.js + Supabase MVP starter'
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <header className="topNav">
          <div className="topNavInner">
            <Link href="/" className="brandLink">
              Kami
            </Link>
            <TopNavLinks />
          </div>
        </header>
        {children}
        <ToastViewport />
      </body>
    </html>
  );
}
