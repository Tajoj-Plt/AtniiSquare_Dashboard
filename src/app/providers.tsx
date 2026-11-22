import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ApiError } from '@/lib/api';
import { AuthProvider } from '@/app/auth';
import { ThemeProvider, useTheme } from '@/app/theme';
import { TooltipProvider } from '@/components/ui/overlays';
import '@/lib/i18n';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // A 401/403/404 will not resolve itself; only retry transient failures.
      retry: (failureCount, error) => {
        if (error instanceof ApiError && [400, 401, 403, 404, 422].includes(error.status)) return false;
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});

/** Toasts follow the active theme and the document's direction. */
function ThemedToaster() {
  const { resolved } = useTheme();
  return (
    <Toaster
      theme={resolved}
      position={document.dir === 'rtl' ? 'bottom-left' : 'bottom-right'}
      richColors
      closeButton
      toastOptions={{ style: { fontFamily: 'inherit' } }}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <TooltipProvider delayDuration={300}>
              {children}
              <ThemedToaster />
            </TooltipProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
