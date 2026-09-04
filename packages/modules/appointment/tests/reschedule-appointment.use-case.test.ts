import { ConflictError, ResourceNotFoundError } from '@salon/shared';
import { describe, expect, it, vi } from 'vitest';
import type {
  IAppointmentRepository,
  RescheduleAppointmentData,
} from '../src/application/ports/appointment-repository.port.js';
import type {
  IBranchValidator,
  IServiceValidator,
  IStaffValidator,
} from '../src/application/ports/appointment-validators.port.js';
import { RescheduleAppointmentUseCase } from '../src/application/use-cases/reschedule-appointment.use-case.js';
import type { AppointmentEntity } from '../src/domain/entities/appointment.entity.js';

describe('RescheduleAppointmentUseCase', () => {
  const businessId = '11111111-1111-1111-1111-111111111111';
  const branchId = '22222222-2222-2222-2222-222222222222';
  const appointmentId = '33333333-3333-3333-3333-333333333333';
  const staffMemberId = '44444444-4444-4444-4444-444444444444';
  const serviceId = '55555555-5555-5555-5555-555555555555';

  const baseAppointment: AppointmentEntity = {
    id: appointmentId,
    businessId,
    branchId,
    businessCustomerId: '66666666-6666-6666-6666-666666666666',
    status: 'confirmed',
    bookingChannel: 'marketplace',
    scheduledStartAt: new Date('2030-06-10T10:00:00.000Z'),
    scheduledEndAt: new Date('2030-06-10T11:00:00.000Z'),
    createdByUserId: null,
    createdByBusinessMemberId: null,
    segments: [
      {
        id: '77777777-7777-7777-7777-777777777777',
        appointmentId,
        serviceId,
        staffMemberId,
        serviceName: 'Haircut',
        staffName: 'Alice',
        unitPrice: '50.00',
        durationMinutes: 60,
        processingTimeMinutes: 0,
        extraTimeMinutes: 0,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
        startsAt: new Date('2030-06-10T10:00:00.000Z'),
        endsAt: new Date('2030-06-10T11:00:00.000Z'),
        sequence: 1,
        notes: null,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const createUseCase = (overrides?: {
    repo?: Partial<IAppointmentRepository>;
    branchValidator?: Partial<IBranchValidator>;
    staffValidator?: Partial<IStaffValidator>;
    serviceValidator?: Partial<IServiceValidator>;
  }) => {
    const repo: IAppointmentRepository = {
      findById: vi.fn().mockResolvedValue(baseAppointment),
      reschedule: vi.fn().mockImplementation(async (data: RescheduleAppointmentData) => ({
        ...baseAppointment,
        scheduledStartAt: data.newScheduledStartAt,
        scheduledEndAt: new Date(data.newScheduledStartAt.getTime() + 60 * 60_000),
      })),
      reserve: vi.fn(),
      findOccupiedAllocations: vi.fn(),
      findAll: vi.fn(),
      cancel: vi.fn(),
      transitionStatus: vi.fn(),
      deleteAllocations: vi.fn(),
      ...overrides?.repo,
    };

    const branchValidator: IBranchValidator = {
      isBranchInBusiness: vi.fn().mockResolvedValue(true),
      getBranchOpeningHoursForDay: vi.fn().mockResolvedValue({
        dayOfWeek: 1,
        isClosed: false,
        opensAt: '09:00:00',
        closesAt: '18:00:00',
      }),
      ...overrides?.branchValidator,
    };

    const staffValidator: IStaffValidator = {
      isStaffMemberActive: vi.fn().mockResolvedValue(true),
      getStaffBookingSnapshots: vi.fn().mockResolvedValue([]),
      getStaffAvailabilitySchedule: vi.fn().mockResolvedValue([
        {
          staffMemberId,
          overrideDurationMinutes: null,
          shifts: [{ startsAt: '09:00:00', endsAt: '17:00:00' }],
          timeOff: [],
        },
      ]),
      ...overrides?.staffValidator,
    };

    const serviceValidator: IServiceValidator = {
      isServiceInBusiness: vi.fn().mockResolvedValue(true),
      isServiceBookableAtBranch: vi.fn().mockResolvedValue(true),
      getServiceSnapshots: vi.fn().mockResolvedValue([]),
      getServiceDetails: vi.fn().mockResolvedValue(null),
      ...overrides?.serviceValidator,
    };

    return {
      useCase: new RescheduleAppointmentUseCase(
        repo,
        branchValidator,
        staffValidator,
        serviceValidator,
      ),
      repo,
      branchValidator,
      staffValidator,
      serviceValidator,
    };
  };

  it('throws ResourceNotFoundError when appointment is not found', async () => {
    const { useCase } = createUseCase({
      repo: { findById: vi.fn().mockResolvedValue(null) },
    });

    await expect(
      useCase.execute({
        businessId,
        appointmentId,
        newScheduledStartAt: new Date('2030-06-10T11:00:00.000Z'),
      }),
    ).rejects.toThrow(ResourceNotFoundError);
  });

  it('throws ConflictError when appointment is in terminal status (completed)', async () => {
    const { useCase } = createUseCase({
      repo: {
        findById: vi.fn().mockResolvedValue({
          ...baseAppointment,
          status: 'completed',
        }),
      },
    });

    await expect(
      useCase.execute({
        businessId,
        appointmentId,
        newScheduledStartAt: new Date('2030-06-10T11:00:00.000Z'),
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('throws ConflictError for marketplace booking when branch is closed on target date', async () => {
    const { useCase } = createUseCase({
      branchValidator: {
        getBranchOpeningHoursForDay: vi.fn().mockResolvedValue({
          dayOfWeek: 1,
          isClosed: true,
          opensAt: null,
          closesAt: null,
        }),
      },
    });

    await expect(
      useCase.execute({
        businessId,
        appointmentId,
        newScheduledStartAt: new Date('2030-06-10T11:00:00.000Z'),
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('throws ConflictError for marketplace booking when time is outside branch opening hours', async () => {
    const { useCase } = createUseCase({
      branchValidator: {
        getBranchOpeningHoursForDay: vi.fn().mockResolvedValue({
          dayOfWeek: 1,
          isClosed: false,
          opensAt: '09:00:00',
          closesAt: '17:00:00',
        }),
      },
    });

    // 17:30 to 18:30 is outside 09:00-17:00
    await expect(
      useCase.execute({
        businessId,
        appointmentId,
        newScheduledStartAt: new Date('2030-06-10T17:30:00.000Z'),
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('throws ConflictError when staff has approved time off overlapping the requested time', async () => {
    const { useCase } = createUseCase({
      staffValidator: {
        getStaffAvailabilitySchedule: vi.fn().mockResolvedValue([
          {
            staffMemberId,
            overrideDurationMinutes: null,
            shifts: [{ startsAt: '09:00:00', endsAt: '18:00:00' }],
            timeOff: [
              {
                startsAt: new Date('2030-06-10T14:00:00.000Z'),
                endsAt: new Date('2030-06-10T16:00:00.000Z'),
              },
            ],
          },
        ]),
      },
    });

    // 14:30 falls inside 14:00 - 16:00 time off
    await expect(
      useCase.execute({
        businessId,
        appointmentId,
        newScheduledStartAt: new Date('2030-06-10T14:30:00.000Z'),
      }),
    ).rejects.toThrow(/approved time off/);
  });

  it('throws ConflictError when staff candidate schedule is not found', async () => {
    const { useCase } = createUseCase({
      staffValidator: {
        getStaffAvailabilitySchedule: vi.fn().mockResolvedValue([]),
      },
    });

    await expect(
      useCase.execute({
        businessId,
        appointmentId,
        newScheduledStartAt: new Date('2030-06-10T11:00:00.000Z'),
      }),
    ).rejects.toThrow(/not scheduled to work/);
  });

  it('validates branch operating hours in the branch timezone', async () => {
    const { useCase } = createUseCase({
      branchValidator: {
        getBranchOpeningHoursForDay: vi.fn().mockResolvedValue({
          dayOfWeek: 1,
          isClosed: false,
          opensAt: '09:00:00',
          closesAt: '18:00:00',
          timezone: 'America/New_York', // UTC-4 in June
        }),
      },
    });

    // 08:30 in New York is 12:30 UTC -> should fail operating hours
    await expect(
      useCase.execute({
        businessId,
        appointmentId,
        newScheduledStartAt: new Date('2030-06-10T12:30:00.000Z'),
      }),
    ).rejects.toThrow(/outside branch operating hours/);
  });

  it('successfully reschedules to an open slot and calls repository.reschedule', async () => {
    const { useCase, repo } = createUseCase();
    const newScheduledStartAt = new Date('2030-06-10T11:00:00.000Z');

    const result = await useCase.execute({
      businessId,
      appointmentId,
      newScheduledStartAt,
      reason: 'Customer requested change',
    });

    expect(result.scheduledStartAt).toEqual(newScheduledStartAt);
    expect(repo.reschedule).toHaveBeenCalledWith({
      businessId,
      appointmentId,
      newScheduledStartAt,
      reason: 'Customer requested change',
    });
  });
});
