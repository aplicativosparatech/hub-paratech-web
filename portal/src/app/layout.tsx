import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hub Paratech - Gestão Fiscal & Tributária Inteligente",
  description: "Sistema de Gestão Fiscal, Reforma Tributária (IBS/CBS) e Automação de Arquivos XML - Paratech Soluções e Sistemas",
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
      { url: '/favicon.ico' }
    ],
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  }
};

import { Toaster } from 'react-hot-toast';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Toaster position="top-right" />
        {children}
      </body>
    </html>
  );
}
