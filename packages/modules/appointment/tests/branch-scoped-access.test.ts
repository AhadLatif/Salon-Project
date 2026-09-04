import { ForbiddenError, ResourceNotFoundError, ValidationError } from '@salon/shared';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { AppointmentController } from '../src/api/controllers/appointment.controller.js';
import type { IAppointmentRepository } from '../src/application/ports/appointment-repository.port.js';
import type { CancelAppointmentUseCase } from '../src/application/use-cases/cancel-appointment.use-case.js';
import type { CreateAppointmentUseCase } from '../src/application/use-cases/create-appointment.use-case.js';
import { GetAppointmentDetailUseCase } from '../src/application/use-cases/get-appointment-detail.use-case.js';
import type { GetAvailabilityUseCase } from '../src/application/use-cases/get-availability.use-case.js';
import type { ListAppointmentsUseCase } from '../src/application/use-cases/list-appointments.use-case.js';
import type { RescheduleAppointmentUseCase } from '../src/application/use-cases/reschedule-appointment.use-case.js';
import type { TransitionAppointmentStatusUseCase } from '../src/application/use-cases/transition-appointment-status.use-case.js';
import type { AppointmentEntity } from '../src/domain/entities/appointment.entity.js';

describe('Branch-Scoped Access Control (Finding 1 IDOR Protection)', () => {
  const businessId = '11111111-1111-4111-a111-111111111111';
  const branchId = '22222222-2222-4222-a222-222222222222';
  const otherBranchId = '88888888-8888-4888-a888-888888888888';
  const appointmentId = '33333333-3333-4333-a333-333333333333';

  const mockAppointment: AppointmentEntity = {
    id: appointmentId,
    businessId,
    branchId,
    businessCustomerId: '44444444-4444-4444-4444-444444444444',
    status: 'confirmed',
    bookingChannel: 'business_dashboard',
    scheduledStartAt: new Date('2030-06-10T10:00:00.000Z'),
    scheduledEndAt: new Date('2030-06-10T11:00:00.000Z'),
    createdByUserId: null,
    createdByBusinessMemberId: null,
    segments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('GetAppointmentDetailUseCase', () => {
    it('returns appointment when branchId matches', async () => {
      const mockRepo: Partial<IAppointmentRepository> = {
        findById: vi.fn().mockImplementation(async (_bId, _aId, brId) => {
          if (brId === branchId) return mockAppointment;
          return null;
        }),
      };

      const useCase = new GetAppointmentDetailUseCase(mockRepo as IAppointmentRepository);
      const result = await useCase.execute(businessId, appointmentId, branchId);
      expect(result).toEqual(mockAppointment);
    });

    it('throws ResourceNotFoundError when branchId does not match (cross-branch IDOR)', async () => {
      const mockRepo: Partial<IAppointmentRepository> = {
        findById: vi.fn().mockImplementation(async (_bId, _aId, brId) => {
          if (brId === branchId) return mockAppointment;
          return null;
        }),
      };

      const useCase = new GetAppointmentDetailUseCase(mockRepo as IAppointmentRepository);
      await expect(useCase.execute(businessId, appointmentId, otherBranchId)).rejects.toThrow(
        ResourceNotFoundError,
      );
    });
  });

  describe('AppointmentController branch validation', () => {
    const createController = (mocks: {
      createAppointment?: unknown;
      getAppointmentDetail?: unknown;
      listAppointments?: unknown;
      cancelAppointment?: unknown;
      transitionStatus?: unknown;
      rescheduleAppointment?: unknown;
    }) => {
      return new AppointmentController(
        (mocks.createAppointment ?? {}) as CreateAppointmentUseCase,
        (mocks.getAppointmentDetail ?? {}) as GetAppointmentDetailUseCase,
        (mocks.listAppointments ?? {}) as ListAppointmentsUseCase,
        (mocks.cancelAppointment ?? {}) as CancelAppointmentUseCase,
        (mocks.transitionStatus ?? {}) as TransitionAppointmentStatusUseCase,
        (mocks.rescheduleAppointment ?? {}) as RescheduleAppointmentUseCase,
        {} as GetAvailabilityUseCase,
      );
    };

    it('create() rejects when body branchId mismatches x-branch-id context', async () => {
      const controller = createController({});
      const req = {
        tenant: { businessId, branchId },
        body: {
          branchId: otherBranchId,
          businessCustomerId: '44444444-4444-4444-4444-444444444444',
          scheduledStartAt: '2030-06-10T10:00:00.000Z',
          bookingChannel: 'business_dashboard',
          segments: [
            {
              serviceId: '55555555-5555-5555-5555-555555555555',
              staffMemberId: '66666666-6666-6666-6666-666666666666',
            },
          ],
        },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      await controller.create(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('findAll() rejects when query branchId mismatches branch context', async () => {
      const controller = createController({});
      const req = {
        tenant: { businessId, branchId },
        query: {
          branchId: otherBranchId,
        },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      await controller.findAll(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });

    it('findById() passes branchId to GetAppointmentDetailUseCase', async () => {
      const getDetailExecute = vi.fn().mockResolvedValue(mockAppointment);
      const controller = createController({
        getAppointmentDetail: { execute: getDetailExecute },
      });

      const req = {
        tenant: { businessId, branchId },
        params: { appointmentId },
      } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();

      await controller.findById(req, res, next);
      expect(getDetailExecute).toHaveBeenCalledWith(businessId, appointmentId, branchId);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('cancel() passes branchId to CancelAppointmentUseCase', async () => {
      const cancelExecute = vi.fn().mockResolvedValue(mockAppointment);
      const controller = createController({
        cancelAppointment: { execute: cancelExecute },
      });

      const req = {
        tenant: { businessId, branchId },
        params: { appointmentId },
        body: { cancellationReason: 'Client called' },
      } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();

      await controller.cancel(req, res, next);
      expect(cancelExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId,
          appointmentId,
          branchId,
        }),
      );
    });

    it('reschedule() passes branchId to RescheduleAppointmentUseCase', async () => {
      const rescheduleExecute = vi.fn().mockResolvedValue(mockAppointment);
      const controller = createController({
        rescheduleAppointment: { execute: rescheduleExecute },
      });

      const req = {
        tenant: { businessId, branchId },
        params: { appointmentId },
        body: { scheduledStartAt: '2030-06-10T14:00:00.000Z' },
      } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();

      await controller.reschedule(req, res, next);
      expect(rescheduleExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId,
          appointmentId,
          branchId,
        }),
      );
    });

    it('transitionStatus() passes branchId to TransitionAppointmentStatusUseCase', async () => {
      const transitionExecute = vi.fn().mockResolvedValue(mockAppointment);
      const controller = createController({
        transitionStatus: { execute: transitionExecute },
      });

      const req = {
        tenant: { businessId, branchId },
        params: { appointmentId },
        body: { status: 'checked_in' },
      } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();

      await controller.transitionStatus(req, res, next);
      expect(transitionExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId,
          appointmentId,
          branchId,
          toStatus: 'checked_in',
        }),
      );
    });
  });
});
