import { ConflictError } from '@salon/shared';
import { describe, expect, it, vi } from 'vitest';
import type {
  IBranchValidator,
  IServiceValidator,
  IStaffValidator,
} from '../src/application/ports/appointment-validators.port.js';
import { AppointmentAvailabilityGuard } from '../src/application/services/appointment-availability.guard.js';

describe('AppointmentAvailabilityGuard', () => {
  const businessId = '11111111-1111-1111-1111-111111111111';
  const branchId = '22222222-2222-2222-2222-222222222222';
  const staffMemberId = '33333333-3333-3333-3333-333333333333';
  const serviceId = '44444444-4444-4444-4444-444444444444';

  const createGuard = (overrides?: {
    branchValidator?: Partial<IBranchValidator>;
    staffValidator?: Partial<IStaffValidator>;
    serviceValidator?: Partial<IServiceValidator>;
  }) => {
    const branchValidator: IBranchValidator = {
      isBranchInBusiness: async () => true,
      getBranchOpeningHoursForDay: async () => ({
        dayOfWeek: 1,
        isClosed: false,
        opensAt: '09:00:00',
        closesAt: '18:00:00',
        timezone: 'UTC',
      }),
      ...overrides?.branchValidator,
    };

    const staffValidator: IStaffValidator = {
      isStaffMemberActive: async () => true,
      getStaffBookingSnapshots: async () => [],
      getStaffAvailabilitySchedule: async () => [
        {
          staffMemberId,
          overrideDurationMinutes: null,
          shifts: [{ startsAt: '09:00:00', endsAt: '17:00:00' }],
          timeOff: [],
        },
      ],
      ...overrides?.staffValidator,
    };

    const serviceValidator: IServiceValidator = {
      isServiceInBusiness: async () => true,
      isServiceBookableAtBranch: async () => true,
      getServiceSnapshots: async () => [],
      getServiceDetails: async () => null,
      ...overrides?.serviceValidator,
    };

    return new AppointmentAvailabilityGuard(branchValidator, staffValidator, serviceValidator);
  };

  it('passes validation when branch is open, service is bookable, staff has shift, and no time off', async () => {
    const guard = createGuard();
    await expect(
      guard.assertBookable({
        businessId,
        branchId,
        bookingChannel: 'marketplace',
        scheduledStartAt: new Date('2030-06-10T10:00:00.000Z'), // Monday
        scheduledEndAt: new Date('2030-06-10T11:00:00.000Z'),
        segments: [
          {
            serviceId,
            staffMemberId,
            startsAt: new Date('2030-06-10T10:00:00.000Z'),
            endsAt: new Date('2030-06-10T11:00:00.000Z'),
          },
        ],
      }),
    ).resolves.toBeUndefined();
  });

  it('rejects when service is not bookable at branch', async () => {
    const guard = createGuard({
      serviceValidator: {
        isServiceBookableAtBranch: vi.fn().mockResolvedValue(false),
      },
    });

    await expect(
      guard.assertBookable({
        businessId,
        branchId,
        bookingChannel: 'marketplace',
        scheduledStartAt: new Date('2030-06-10T10:00:00.000Z'),
        scheduledEndAt: new Date('2030-06-10T11:00:00.000Z'),
        segments: [
          {
            serviceId,
            staffMemberId,
            startsAt: new Date('2030-06-10T10:00:00.000Z'),
            endsAt: new Date('2030-06-10T11:00:00.000Z'),
          },
        ],
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('rejects marketplace booking when branch is closed', async () => {
    const guard = createGuard({
      branchValidator: {
        getBranchOpeningHoursForDay: vi.fn().mockResolvedValue({
          dayOfWeek: 1,
          isClosed: true,
          opensAt: null,
          closesAt: null,
          timezone: 'UTC',
        }),
      },
    });

    await expect(
      guard.assertBookable({
        businessId,
        branchId,
        bookingChannel: 'marketplace',
        scheduledStartAt: new Date('2030-06-10T10:00:00.000Z'),
        scheduledEndAt: new Date('2030-06-10T11:00:00.000Z'),
        segments: [
          {
            serviceId,
            staffMemberId,
            startsAt: new Date('2030-06-10T10:00:00.000Z'),
            endsAt: new Date('2030-06-10T11:00:00.000Z'),
          },
        ],
      }),
    ).rejects.toThrow('Cannot book appointment: branch is closed on the selected date.');
  });

  it('allows dashboard booking even when branch opening hours are closed or omitted', async () => {
    const guard = createGuard({
      branchValidator: {
        getBranchOpeningHoursForDay: vi.fn().mockResolvedValue({
          dayOfWeek: 1,
          isClosed: true,
          opensAt: null,
          closesAt: null,
          timezone: 'UTC',
        }),
      },
    });

    await expect(
      guard.assertBookable({
        businessId,
        branchId,
        bookingChannel: 'business_dashboard',
        scheduledStartAt: new Date('2030-06-10T10:00:00.000Z'),
        scheduledEndAt: new Date('2030-06-10T11:00:00.000Z'),
        segments: [
          {
            serviceId,
            staffMemberId,
            startsAt: new Date('2030-06-10T10:00:00.000Z'),
            endsAt: new Date('2030-06-10T11:00:00.000Z'),
          },
        ],
      }),
    ).resolves.toBeUndefined();
  });

  it('rejects marketplace booking when staff member has no matching shift', async () => {
    const guard = createGuard({
      staffValidator: {
        getStaffAvailabilitySchedule: vi.fn().mockResolvedValue([
          {
            staffMemberId,
            shifts: [{ startsAt: '12:00:00', endsAt: '17:00:00' }],
            timeOff: [],
          },
        ]),
      },
    });

    await expect(
      guard.assertBookable({
        businessId,
        branchId,
        bookingChannel: 'marketplace',
        scheduledStartAt: new Date('2030-06-10T10:00:00.000Z'),
        scheduledEndAt: new Date('2030-06-10T11:00:00.000Z'),
        segments: [
          {
            serviceId,
            staffMemberId,
            startsAt: new Date('2030-06-10T10:00:00.000Z'),
            endsAt: new Date('2030-06-10T11:00:00.000Z'),
          },
        ],
      }),
    ).rejects.toThrow('is not scheduled to work at the selected time');
  });

  it('rejects booking across all channels when staff has approved time off', async () => {
    const guard = createGuard({
      staffValidator: {
        getStaffAvailabilitySchedule: vi.fn().mockResolvedValue([
          {
            staffMemberId,
            shifts: [{ startsAt: '08:00:00', endsAt: '20:00:00' }],
            timeOff: [
              {
                startsAt: new Date('2030-06-10T09:30:00.000Z'),
                endsAt: new Date('2030-06-10T10:30:00.000Z'),
              },
            ],
          },
        ]),
      },
    });

    await expect(
      guard.assertBookable({
        businessId,
        branchId,
        bookingChannel: 'walk_in',
        scheduledStartAt: new Date('2030-06-10T10:00:00.000Z'),
        scheduledEndAt: new Date('2030-06-10T11:00:00.000Z'),
        segments: [
          {
            serviceId,
            staffMemberId,
            startsAt: new Date('2030-06-10T10:00:00.000Z'),
            endsAt: new Date('2030-06-10T11:00:00.000Z'),
          },
        ],
      }),
    ).rejects.toThrow('has approved time off during the requested slot');
  });

  it('passes exact branch-local day bounds to staff schedule query', async () => {
    const getStaffAvailabilitySchedule = vi.fn().mockResolvedValue([
      {
        staffMemberId,
        shifts: [{ startsAt: '09:00:00', endsAt: '18:00:00' }],
        timeOff: [],
      },
    ]);

    const guard = createGuard({
      staffValidator: {
        getStaffAvailabilitySchedule,
      },
    });

    await guard.assertBookable({
      businessId,
      branchId,
      bookingChannel: 'marketplace',
      scheduledStartAt: new Date('2030-06-10T10:00:00.000Z'),
      scheduledEndAt: new Date('2030-06-10T11:00:00.000Z'),
      segments: [
        {
          serviceId,
          staffMemberId,
          startsAt: new Date('2030-06-10T10:00:00.000Z'),
          endsAt: new Date('2030-06-10T11:00:00.000Z'),
        },
      ],
    });

    expect(getStaffAvailabilitySchedule).toHaveBeenCalledWith(
      businessId,
      expect.objectContaining({
        dayStartUtc: expect.any(Date),
        dayEndUtc: expect.any(Date),
      }),
    );
  });
});
