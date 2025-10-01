import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { cn } from '@/lib/utils';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/contexts/AuthContext';
import { QueryProvider } from '@/components/providers/QueryProvider';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'WAREOPS',
  description: 'Warehouse Operations Management',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={cn(
        'font-body antialiased h-full',
        inter.variable
      )}>
        <QueryProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </QueryProvider>
        <Toaster />
      </body>
    </html>
  );
}
