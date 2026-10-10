import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="h-[100dvh] w-full bg-white overflow-hidden">{children}</main>;
}
