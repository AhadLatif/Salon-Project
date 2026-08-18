import type { db } from '@salon/database';
import { type RequestHandler, Router } from 'express';
import { StaffMemberController } from './api/controllers/staff-member.controller.js';
import { AddShiftToScheduleUseCase } from './application/use-cases/add-shift-to-schedule.use-case.js';
import { AssignServiceToStaffUseCase } from './application/use-cases/assign-service-to-staff.use-case.js';
import { AssignStaffToBranchUseCase } from './application/use-cases/assign-staff-to-branch.use-case.js';
import { CreateStaffMemberUseCase } from './application/use-cases/create-staff-member.use-case.js';
import { CreateStaffWorkScheduleUseCase } from './application/use-cases/create-staff-work-schedule.use-case.js';
import { DeactivateStaffMemberUseCase } from './application/use-cases/deactivate-staff-member.use-case.js';
import { GetStaffMemberDetailsUseCase } from './application/use-cases/get-staff-member-details.use-case.js';
import { GetStaffMembersUseCase } from './application/use-cases/get-staff-members.use-case.js';
import { GetStaffWorkSchedulesUseCase } from './application/use-cases/get-staff-work-schedules.use-case.js';
import { UnassignServiceFromStaffUseCase } from './application/use-cases/unassign-service-from-staff.use-case.js';
import { UnassignStaffFromBranchUseCase } from './application/use-cases/unassign-staff-from-branch.use-case.js';
import { UpdateStaffMemberUseCase } from './application/use-cases/update-staff-member.use-case.js';
import { StaffRepository } from './infrastructure/repositories/staff.repository.js';

export * from './api/controllers/staff-member.controller.js';
export * from './api/docs/staff.openapi.js';
export * from './api/dtos/assign-service-to-staff.schema.js';
export * from './api/dtos/assign-staff-to-branch.schema.js';
export * from './api/dtos/create-staff-member.schema.js';
export * from './api/dtos/create-staff-work-schedule.schema.js';
export * from './api/dtos/unassign-service-from-staff.schema.js';
export * from './api/dtos/update-staff-member.schema.js';
export * from './application/ports/staff-repository.port.js';
export * from './domain/entities/staff-member.entity.js';
export * from './infrastructure/repositories/staff.repository.js';

export interface StaffModuleDependencies {
  database: typeof db;
  authMiddleware: RequestHandler;
  tenantMiddleware: RequestHandler;
  requirePermission: (permissionCode: string) => RequestHandler;
  requireBranchContext: RequestHandler;
}

export interface StaffModule {
  staffRouter: Router;
  useCases: {
    createStaffMemberUseCase: CreateStaffMemberUseCase;
    updateStaffMemberUseCase: UpdateStaffMemberUseCase;
    deactivateStaffMemberUseCase: DeactivateStaffMemberUseCase;
    getStaffMemberDetailsUseCase: GetStaffMemberDetailsUseCase;
    getStaffMembersUseCase: GetStaffMembersUseCase;
    assignStaffToBranchUseCase: AssignStaffToBranchUseCase;
    unassignStaffFromBranchUseCase: UnassignStaffFromBranchUseCase;
    assignServiceToStaffUseCase: AssignServiceToStaffUseCase;
    unassignServiceFromStaffUseCase: UnassignServiceFromStaffUseCase;
    createStaffWorkScheduleUseCase: CreateStaffWorkScheduleUseCase;
    addShiftToScheduleUseCase: AddShiftToScheduleUseCase;
    getStaffWorkSchedulesUseCase: GetStaffWorkSchedulesUseCase;
  };
}

export function createStaffModule(deps: StaffModuleDependencies): StaffModule {
  const staffRepository = new StaffRepository(deps.database);

  const createStaffMemberUseCase = new CreateStaffMemberUseCase(staffRepository);
  const updateStaffMemberUseCase = new UpdateStaffMemberUseCase(staffRepository);
  const deactivateStaffMemberUseCase = new DeactivateStaffMemberUseCase(staffRepository);
  const getStaffMemberDetailsUseCase = new GetStaffMemberDetailsUseCase(staffRepository);
  const getStaffMembersUseCase = new GetStaffMembersUseCase(staffRepository);
  const assignStaffToBranchUseCase = new AssignStaffToBranchUseCase(staffRepository);
  const unassignStaffFromBranchUseCase = new UnassignStaffFromBranchUseCase(staffRepository);
  const assignServiceToStaffUseCase = new AssignServiceToStaffUseCase(staffRepository);
  const unassignServiceFromStaffUseCase = new UnassignServiceFromStaffUseCase(staffRepository);
  const createStaffWorkScheduleUseCase = new CreateStaffWorkScheduleUseCase(staffRepository);
  const addShiftToScheduleUseCase = new AddShiftToScheduleUseCase(staffRepository);
  const getStaffWorkSchedulesUseCase = new GetStaffWorkSchedulesUseCase(staffRepository);

  const staffController = new StaffMemberController(
    createStaffMemberUseCase,
    updateStaffMemberUseCase,
    deactivateStaffMemberUseCase,
    getStaffMemberDetailsUseCase,
    getStaffMembersUseCase,
    assignStaffToBranchUseCase,
    unassignStaffFromBranchUseCase,
    assignServiceToStaffUseCase,
    unassignServiceFromStaffUseCase,
    createStaffWorkScheduleUseCase,
    addShiftToScheduleUseCase,
    getStaffWorkSchedulesUseCase,
  );

  const staffRouter = Router({ mergeParams: true });

  // Middleware applied to all staff routes
  staffRouter.use(deps.authMiddleware);
  staffRouter.use(deps.tenantMiddleware);

  staffRouter.get(
    '/',
    deps.requirePermission('staff.read'),
    staffController.findAll.bind(staffController),
  );
  staffRouter.get(
    '/:staffMemberId',
    deps.requirePermission('staff.read'),
    staffController.findById.bind(staffController),
  );
  staffRouter.post(
    '/',
    deps.requirePermission('staff.create'),
    staffController.create.bind(staffController),
  );
  staffRouter.patch(
    '/:staffMemberId',
    deps.requirePermission('staff.update'),
    staffController.update.bind(staffController),
  );
  staffRouter.delete(
    '/:staffMemberId',
    deps.requirePermission('staff.delete'),
    staffController.deactivate.bind(staffController),
  );

  staffRouter.post(
    '/:staffMemberId/branches',
    deps.requirePermission('staff.update'),
    staffController.assignToBranch.bind(staffController),
  );
  staffRouter.delete(
    '/:staffMemberId/branches/:branchId',
    deps.requirePermission('staff.update'),
    staffController.unassignFromBranch.bind(staffController),
  );

  staffRouter.post(
    '/:staffMemberId/services',
    deps.requirePermission('staff.update'),
    staffController.assignService.bind(staffController),
  );
  staffRouter.delete(
    '/:staffMemberId/services/:serviceId',
    deps.requirePermission('staff.update'),
    staffController.unassignService.bind(staffController),
  );

  staffRouter.post(
    '/:staffMemberId/schedules',
    deps.requirePermission('staff.update'),
    deps.requireBranchContext,
    staffController.createWorkSchedule.bind(staffController),
  );
  staffRouter.get(
    '/:staffMemberId/schedules',
    deps.requirePermission('staff.read'),
    deps.requireBranchContext,
    staffController.getWorkSchedules.bind(staffController),
  );
  staffRouter.post(
    '/:staffMemberId/schedules/:workScheduleId/shifts',
    deps.requirePermission('staff.update'),
    deps.requireBranchContext,
    staffController.addShiftToSchedule.bind(staffController),
  );

  return {
    staffRouter,
    useCases: {
      createStaffMemberUseCase,
      updateStaffMemberUseCase,
      deactivateStaffMemberUseCase,
      getStaffMemberDetailsUseCase,
      getStaffMembersUseCase,
      assignStaffToBranchUseCase,
      unassignStaffFromBranchUseCase,
      assignServiceToStaffUseCase,
      unassignServiceFromStaffUseCase,
      createStaffWorkScheduleUseCase,
      addShiftToScheduleUseCase,
      getStaffWorkSchedulesUseCase,
    },
  };
}
