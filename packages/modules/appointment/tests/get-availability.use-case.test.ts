import { ResourceNotFoundError } from '@salon/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IAppointmentRepository,
  OccupiedAllocationInterval,
} from '../src/application/ports/appointment-repository.port.js';
import type {
  BranchOpeningHoursSnapshot,
  IBranchValidator,
  IServiceValidator,
  IStaffValidator,
  ServiceSnapshot,
  StaffScheduleCandidate,
} from '../src/application/ports/appointment-validators.port.js';
import { GetAvailabilityUseCase } from '../src/application/use-cases/get-availability.use-case.js';

describe('GetAvailabilityUseCase Integration Unit Tests', () => {
  let appointmentRepo: IAppointmentRepository;
  let branchValidator: IBranchValidator;
  let serviceValidator: IServiceValidator;
  let staffValidator: IStaffValidator;
  let useCase: GetAvailabilityUseCase;

  const mockService: ServiceSnapshot = {
    id: 'svc-1',
    name: 'Haircut',
    defaultPrice: '40.00',
    defaultDurationMinutes: 60,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    isActive: true,
  };

  const mockBranchHours: BranchOpeningHoursSnapshot = {
    dayOfWeek: 3,
    isClosed: false,
    opensAt: '09:00:00',
    closesAt: '17:00:00',
  };

  const mockStaffCandidate: StaffScheduleCandidate = {
    staffMemberId: 'staff-1',
    overrideDurationMinutes: null,
    shifts: [{ startsAt: '09:00:00', endsAt: '17:00:00' }],
    timeOff: [],
  };

  beforeEach(() => {
    appointmentRepo = {
      reserve: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      cancel: vi.fn(),
      transitionStatus: vi.fn(),
      reschedule: vi.fn(),
      deleteAllocations: vi.fn(),
      findOccupiedAllocations: vi.fn().mockResolvedValue([]),
    };

    branchValidator = {
      isBranchInBusiness: vi.fn().mockResolvedValue(true),
      getBranchOpeningHoursForDay: vi.fn().mockResolvedValue(mockBranchHours),
    };

    serviceValidator = {
      isServiceInBusiness: vi.fn().mockResolvedValue(true),
      getServiceSnapshots: vi.fn().mockResolvedValue([mockService]),
      getServiceDetails: vi.fn().mockResolvedValue(mockService),
    };

    staffValidator = {
      isStaffMemberActive: vi.fn().mockResolvedValue(true),
      getStaffBookingSnapshots: vi.fn().mockResolvedValue([]),
      getStaffAvailabilitySchedule: vi.fn().mockResolvedValue([mockStaffCandidate]),
    };

    useCase = new GetAvailabilityUseCase(
      appointmentRepo,
      branchValidator,
      serviceValidator,
      staffValidator,
    );
  });

  it('throws ResourceNotFoundError if service does not exist or is inactive', async () => {
    vi.mocked(serviceValidator.getServiceDetails).mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        businessId: 'biz-1',
        branchId: 'branch-1',
        serviceId: 'svc-invalid',
        date: '2030-01-02',
      }),
    ).rejects.toThrow(ResourceNotFoundError);
  });

  it('returns empty array if branch is closed on that day', async () => {
    vi.mocked(branchValidator.getBranchOpeningHoursForDay).mockResolvedValueOnce({
      dayOfWeek: 3,
      isClosed: true,
      opensAt: null,
      closesAt: null,
    });

    const slots = await useCase.execute({
      businessId: 'biz-1',
      branchId: 'branch-1',
      serviceId: 'svc-1',
      date: '2030-01-02',
    });

    expect(slots).toEqual([]);
  });

  it('returns empty array if no staff candidates are eligible', async () => {
    vi.mocked(staffValidator.getStaffAvailabilitySchedule).mockResolvedValueOnce([]);

    const slots = await useCase.execute({
      businessId: 'biz-1',
      branchId: 'branch-1',
      serviceId: 'svc-1',
      date: '2030-01-02',
    });

    expect(slots).toEqual([]);
  });

  it('computes available slots and filters out occupied appointment allocations', async () => {
    const occupiedAllocations: OccupiedAllocationInterval[] = [
      {
        staffMemberId: 'staff-1',
        occupiedStart: new Date('2030-01-02T10:00:00.000Z'),
        occupiedEnd: new Date('2030-01-02T11:00:00.000Z'),
      },
    ];
    vi.mocked(appointmentRepo.findOccupiedAllocations).mockResolvedValueOnce(occupiedAllocations);

    const slots = await useCase.execute({
      businessId: 'biz-1',
      branchId: 'branch-1',
      serviceId: 'svc-1',
      date: '2030-01-02',
    });

    expect(slots.length).toBeGreaterThan(0);
    // Ensure no slot overlaps with 10:00-11:00
    for (const slot of slots) {
      expect(slot.startsAt.toISOString()).not.toBe('2030-01-02T10:00:00.000Z');
    }
    expect(appointmentRepo.findOccupiedAllocations).toHaveBeenCalledWith(
      'biz-1',
      ['staff-1'],
      expect.any(Date),
      expect.any(Date),
    );
  });
});
