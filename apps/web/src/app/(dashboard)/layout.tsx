'use client';

import { Button } from '@salon/ui';
import {
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Menu,
  Scissors,
  Settings,
  Store,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { useSession } from '@/features/auth/session';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { status, user, logout } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div
        role="status"
        aria-label="Checking your session"
        className="flex min-h-[100dvh] items-center justify-center bg-neutral-50"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-950" />
      </div>
    );
  }

  if (status === 'unauthenticated' || !user) {
    return null;
  }

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Calendar', href: '/calendar', icon: CalendarDays },
    { name: 'Customers', href: '/customers', icon: Users },
    { name: 'Services', href: '/services', icon: Scissors },
    { name: 'Branch', href: '/branch', icon: Store },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <div className="flex min-h-[100dvh] bg-neutral-50">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-neutral-200 bg-white md:flex">
        <div className="flex h-16 items-center border-b border-neutral-200 px-6">
          <Store className="h-5 w-5 text-neutral-950" />
          <span className="ml-3 font-semibold text-neutral-950">Salon Platform</span>
        </div>
        <nav className="flex-1 space-y-1.5 p-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-neutral-950 text-white font-semibold'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-neutral-200 p-4">
          <div className="mb-4 flex items-center px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-950 font-semibold text-sm">
              {user.fullName?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="ml-3 overflow-hidden">
              <p className="truncate text-sm font-semibold text-neutral-950">{user.fullName}</p>
              <p className="truncate text-xs text-neutral-500">{user.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 rounded-full text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
            onClick={() => {
              logout();
              router.push('/login');
            }}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Mobile header */}
        <header className="flex h-16 items-center justify-between border-b border-neutral-200 bg-white px-4 md:hidden">
          <div className="flex items-center gap-3">
            <Store className="h-5 w-5 text-neutral-950" />
            <span className="font-semibold text-neutral-950">Salon</span>
          </div>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Menu className="h-5 w-5 text-neutral-600" />
          </Button>
        </header>

        <main className="flex-1 p-6 md:p-10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
