import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Manrope } from 'next/font/google';

import { TopNavLinks } from '@/components/top-nav-links';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-brand'
});

export const metadata: Metadata = {
  title: 'Kami MVP',
  description: 'Next.js + Supabase MVP starter'
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className={manrope.variable}>
        <header className="topNav">
          <div className="topNavInner">
            <Link href="/" className="brandLink">
              Kami
            </Link>
            <TopNavLinks />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
