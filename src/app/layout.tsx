import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import './similarweb-theme.css';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI-Powered SEO Content Editor",
  description: "Create SEO-optimized content with AI assistance and keyword optimization",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
