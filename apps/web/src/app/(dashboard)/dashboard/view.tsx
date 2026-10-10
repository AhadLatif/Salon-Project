'use client';

import { Card } from '@salon/ui';
import { CalendarDays, Users } from 'lucide-react';
import { useSession } from '@/features/auth/session';

/** Honest empty states — no invented metrics (craft floor: claims come from truth). */
export function DashboardView() {
  const { user } = useSession();

  const firstName = user?.fullName?.split(' ')[0] ?? 'there';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-950">
          Welcome back, {firstName}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Your workspace is ready — bookings and customers will show up here.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-950">
              <CalendarDays aria-hidden="true" className="h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold text-neutral-950">Appointments</h2>
          </div>
          <p className="mt-4 text-sm text-neutral-500 leading-relaxed">
            No appointments yet. New bookings appear here as soon as customers confirm them.
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-950">
              <Users aria-hidden="true" className="h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold text-neutral-950">Customers</h2>
          </div>
          <p className="mt-4 text-sm text-neutral-500 leading-relaxed">
            No customers yet. Add your first customer to start building your book.
          </p>
        </Card>
      </div>
    </div>
  );
}
