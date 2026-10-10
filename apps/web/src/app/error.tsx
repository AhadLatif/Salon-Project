'use client';

import { Button } from '@salon/ui';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // We could log this to an error reporting service
    console.error('App Error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="flex max-w-md flex-col items-center space-y-8 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30">
          <AlertCircle className="h-10 w-10 text-red-500 dark:text-red-400" strokeWidth={1.5} />
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Something went wrong
          </h1>
          <p className="text-base text-zinc-500 dark:text-zinc-400">
            We encountered an unexpected error. Please try again or contact support if the issue
            persists.
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => window.location.reload()} variant="outline" className="gap-2">
            Reload Page
          </Button>
          <Button onClick={() => reset()} variant="default" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    </div>
  );
}
