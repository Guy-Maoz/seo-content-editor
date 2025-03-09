import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AITransparencyProvider } from '@/contexts/AITransparencyContext';
import './similarweb-theme.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SEO Content Editor',
  description: 'AI-powered SEO content editor with keyword research tools',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} overflow-x-hidden`}>
        <AITransparencyProvider>
          <div className="min-h-screen flex">
            <main className="flex-1">
              {children}
            </main>
          </div>
        </AITransparencyProvider>
      </body>
    </html>
  );
}
