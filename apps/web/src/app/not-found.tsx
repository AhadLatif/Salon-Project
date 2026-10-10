import { Button } from '@salon/ui';
import { FileQuestion, MoveLeft } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="flex max-w-md flex-col items-center space-y-8 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900">
          <FileQuestion className="h-10 w-10 text-zinc-400" strokeWidth={1.5} />
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Page not found
          </h1>
          <p className="text-base text-zinc-500 dark:text-zinc-400">
            We couldn't find the page you're looking for. It might have been moved, deleted, or
            perhaps the URL is incorrect.
          </p>
        </div>
        <Button asChild variant="default" className="gap-2">
          <Link href="/">
            <MoveLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
