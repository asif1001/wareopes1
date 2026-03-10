'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import dynamic from 'next/dynamic';

import { queryClient } from '@/lib/react-query/client';

interface QueryProviderProps {
  children: React.ReactNode;
}

// Lazily load React Query Devtools only in development to reduce initial bundle size
const ReactQueryDevtoolsLazy = process.env.NODE_ENV === 'development'
  ? dynamic(() => import('@tanstack/react-query-devtools').then(mod => ({ default: mod.ReactQueryDevtools })), { ssr: false })
  : (() => null as any);

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtoolsLazy initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}