import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './similarweb-theme.css';
import ClientProviders from './ClientProviders';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AI SEO Content Editor',
  description: 'Generate SEO-optimized content with AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
