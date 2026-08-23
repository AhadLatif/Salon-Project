import { getTenantContext, getUuidParam, validateBody } from '@salon/shared';
import type { NextFunction, Request, Response } from 'express';
import type { AddCustomerNoteUseCase } from '../../application/use-cases/add-customer-note.use-case.js';
import type { ArchiveCustomerUseCase } from '../../application/use-cases/archive-customer.use-case.js';
import type { AssignCustomerTagUseCase } from '../../application/use-cases/assign-customer-tag.use-case.js';
import type { CreateCustomerUseCase } from '../../application/use-cases/create-customer.use-case.js';
import type { DeleteCustomerNoteUseCase } from '../../application/use-cases/delete-customer-note.use-case.js';
import type { GetCustomerDetailsUseCase } from '../../application/use-cases/get-customer-details.use-case.js';
import type { GetCustomerNotesUseCase } from '../../application/use-cases/get-customer-notes.use-case.js';
import type { GetCustomersUseCase } from '../../application/use-cases/get-customers.use-case.js';
import type { UnassignCustomerTagUseCase } from '../../application/use-cases/unassign-customer-tag.use-case.js';
import type { UpdateCustomerUseCase } from '../../application/use-cases/update-customer.use-case.js';
import { assignCustomerTagSchema } from '../dtos/assign-customer-tag.schema.js';
import { createCustomerSchema } from '../dtos/create-customer.schema.js';
import { createCustomerNoteSchema } from '../dtos/create-customer-note.schema.js';
import { getCustomersQuerySchema } from '../dtos/get-customers-query.schema.js';
import { updateCustomerSchema } from '../dtos/update-customer.schema.js';

export class CustomerController {
  constructor(
    private readonly createCustomerUseCase: CreateCustomerUseCase,
    private readonly getCustomersUseCase: GetCustomersUseCase,
    private readonly getCustomerDetailsUseCase: GetCustomerDetailsUseCase,
    private readonly updateCustomerUseCase: UpdateCustomerUseCase,
    private readonly archiveCustomerUseCase: ArchiveCustomerUseCase,
    private readonly addCustomerNoteUseCase: AddCustomerNoteUseCase,
    private readonly getCustomerNotesUseCase: GetCustomerNotesUseCase,
    private readonly deleteCustomerNoteUseCase: DeleteCustomerNoteUseCase,
    private readonly assignCustomerTagUseCase: AssignCustomerTagUseCase,
    private readonly unassignCustomerTagUseCase: UnassignCustomerTagUseCase,
  ) {}

  /**
   * Onboards a new customer profile into the salon CRM directory.
   *
   * @http POST /api/v1/businesses/:businessId/customers
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   * @body
   *   - firstName: string (1-100 chars)
   *   - lastName?: string (1-100 chars)
   *   - phoneNumber?: string (E.164 format)
   *   - email?: string (valid email format, normalized to lowercase)
   *   - gender?: 'female' | 'male' | 'non_binary' | 'prefer_not_to_say'
   *   - dateOfBirth?: 'YYYY-MM-DD'
   *   - marketingOptIn?: boolean
   *   - userId?: string (UUID, optional link to marketplace B2C user account)
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('customer.create')
   *          -> CustomerController.create
   *          -> validateBody(createCustomerSchema)
   *          -> CreateCustomerUseCase.execute
   *          -> CustomerRepository.create
   *
   * @returns 201 Created { success: true, data: { customer: { id, firstName, email, ... } }, meta: {} }
   * @throws 400 Bad Request (Validation failure)
   * @throws 401 Unauthorized
   * @throws 403 Forbidden (Insufficient permissions)
   * @throws 409 Conflict (Email already registered in this business's directory)
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId } = getTenantContext(req);
      const data = validateBody(createCustomerSchema, req.body, 'Invalid customer profile data');

      const customer = await this.createCustomerUseCase.execute({
        ...data,
        businessId,
      });

      res.status(201).json({
        success: true,
        data: { customer },
        error: null,
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Lists customer profiles for the tenant with pagination and optional search/tag/status filters.
   *
   * @http GET /api/v1/businesses/:businessId/customers
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   * @query
   *   - page?: number (default 1)
   *   - limit?: number (default 20, max 100)
   *   - search?: string (partial match on firstName, lastName, email, phoneNumber)
   *   - tagId?: string (UUID filter)
   *   - status?: 'active' | 'archived' | 'all' (default 'active')
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('customer.view')
   *          -> CustomerController.findAll
   *          -> validateBody(getCustomersQuerySchema, req.query)
   *          -> GetCustomersUseCase.execute(businessId, query)
   *          -> CustomerRepository.findAll
   *
   * @returns 200 OK { success: true, data: { customers: [ ... ], total: number }, meta: { page, limit } }
   * @throws 400 Bad Request (Invalid query parameters)
   * @throws 401 Unauthorized
   */
  async findAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId } = getTenantContext(req);
      const query = validateBody(
        getCustomersQuerySchema,
        req.query,
        'Invalid customer query parameters',
      );

      const result = await this.getCustomersUseCase.execute(businessId, query);

      res.status(200).json({
        success: true,
        data: {
          customers: result.customers,
          total: result.total,
        },
        error: null,
        meta: {
          page: query.page,
          limit: query.limit,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves full customer details and assigned tags for the CRM profile view.
   *
   * @http GET /api/v1/businesses/:businessId/customers/:customerId
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :customerId (UUID)
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('customer.view')
   *          -> CustomerController.findById
   *          -> GetCustomerDetailsUseCase.execute(businessId, customerId)
   *          -> CustomerRepository.findDetailsById
   *
   * @returns 200 OK { success: true, data: { customer: { id, firstName, tags: [ ... ], ... } }, meta: {} }
   * @throws 400 Bad Request (Invalid customerId UUID)
   * @throws 404 Not Found (Customer profile does not exist in this business)
   */
  async findById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId } = getTenantContext(req);
      const customerId = getUuidParam(req, 'customerId');

      const customer = await this.getCustomerDetailsUseCase.execute(businessId, customerId);

      res.status(200).json({
        success: true,
        data: { customer },
        error: null,
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Updates mutable fields on an existing customer profile.
   *
   * @http PATCH /api/v1/businesses/:businessId/customers/:customerId
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :customerId (UUID)
   * @body
   *   - Partial<UpdateCustomerDto>
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('customer.update')
   *          -> CustomerController.update
   *          -> validateBody(updateCustomerSchema)
   *          -> UpdateCustomerUseCase.execute(businessId, customerId, data)
   *          -> CustomerRepository.update
   *
   * @returns 200 OK { success: true, data: { customer: { ... } }, meta: {} }
   * @throws 400 Bad Request
   * @throws 404 Not Found
   * @throws 409 Conflict (Email collision)
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId } = getTenantContext(req);
      const customerId = getUuidParam(req, 'customerId');
      const data = validateBody(updateCustomerSchema, req.body, 'Invalid customer update payload');

      const customer = await this.updateCustomerUseCase.execute(businessId, customerId, data);

      res.status(200).json({
        success: true,
        data: { customer },
        error: null,
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Soft-archives a customer profile, transitioning status to 'archived'.
   *
   * @http DELETE /api/v1/businesses/:businessId/customers/:customerId
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :customerId (UUID)
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('customer.delete')
   *          -> CustomerController.archive
   *          -> ArchiveCustomerUseCase.execute(businessId, customerId)
   *          -> CustomerRepository.archive
   *
   * @returns 200 OK { success: true, data: { customer: { status: 'archived', ... } }, meta: {} }
   * @throws 404 Not Found
   */
  async archive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId } = getTenantContext(req);
      const customerId = getUuidParam(req, 'customerId');

      const customer = await this.archiveCustomerUseCase.execute(businessId, customerId);

      res.status(200).json({
        success: true,
        data: { customer },
        error: null,
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Adds an internal CRM note attached to a customer profile.
   *
   * @http POST /api/v1/businesses/:businessId/customers/:customerId/notes
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :customerId (UUID)
   * @body
   *   - note: string (1-2000 chars)
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('customer.update')
   *          -> CustomerController.addNote
   *          -> validateBody(createCustomerNoteSchema)
   *          -> AddCustomerNoteUseCase.execute
   *          -> CustomerNoteRepository.create
   *
   * @returns 201 Created { success: true, data: { note: { id, note, authorId, ... } }, meta: {} }
   * @throws 400 Bad Request
   * @throws 404 Not Found (Customer profile does not exist)
   */
  async addNote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId, memberId } = getTenantContext(req);
      const customerId = getUuidParam(req, 'customerId');
      const { note } = validateBody(
        createCustomerNoteSchema,
        req.body,
        'Invalid customer note payload',
      );

      const customerNote = await this.addCustomerNoteUseCase.execute({
        businessId,
        businessCustomerId: customerId,
        authorId: memberId,
        note,
      });

      res.status(201).json({
        success: true,
        data: { note: customerNote },
        error: null,
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves all internal CRM notes for a customer profile ordered by creation date descending.
   *
   * @http GET /api/v1/businesses/:businessId/customers/:customerId/notes
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :customerId (UUID)
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('customer.view')
   *          -> CustomerController.getNotes
   *          -> GetCustomerNotesUseCase.execute(businessId, customerId)
   *          -> CustomerNoteRepository.findByCustomerId
   *
   * @returns 200 OK { success: true, data: { notes: [ ... ] }, meta: {} }
   * @throws 404 Not Found
   */
  async getNotes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId } = getTenantContext(req);
      const customerId = getUuidParam(req, 'customerId');

      const notes = await this.getCustomerNotesUseCase.execute(businessId, customerId);

      res.status(200).json({
        success: true,
        data: { notes },
        error: null,
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Deletes a specific internal CRM note.
   *
   * @http DELETE /api/v1/businesses/:businessId/customers/:customerId/notes/:noteId
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :customerId (UUID)
   *   - :noteId (UUID)
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('customer.update')
   *          -> CustomerController.deleteNote
   *          -> DeleteCustomerNoteUseCase.execute(businessId, customerId, noteId)
   *          -> CustomerNoteRepository.delete
   *
   * @returns 200 OK { success: true, data: { deleted: true }, meta: {} }
   * @throws 404 Not Found
   */
  async deleteNote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId } = getTenantContext(req);
      const customerId = getUuidParam(req, 'customerId');
      const noteId = getUuidParam(req, 'noteId');

      await this.deleteCustomerNoteUseCase.execute(businessId, customerId, noteId);

      res.status(200).json({
        success: true,
        data: { deleted: true },
        error: null,
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Assigns a CRM tag to a customer profile idempotently.
   *
   * @http POST /api/v1/businesses/:businessId/customers/:customerId/tags
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :customerId (UUID)
   * @body
   *   - tagId: string (UUID)
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('customer.update')
   *          -> CustomerController.assignTag
   *          -> validateBody(assignCustomerTagSchema)
   *          -> AssignCustomerTagUseCase.execute
   *          -> CustomerTagRepository.assignTag
   *
   * @returns 201 Created { success: true, data: { assignment: { customerId, tagId, ... } }, meta: {} }
   * @throws 400 Bad Request
   * @throws 404 Not Found (Customer or Tag not found)
   */
  async assignTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId, memberId } = getTenantContext(req);
      const customerId = getUuidParam(req, 'customerId');
      const { tagId } = validateBody(
        assignCustomerTagSchema,
        req.body,
        'Invalid tag assignment payload',
      );

      const assignment = await this.assignCustomerTagUseCase.execute(
        businessId,
        customerId,
        tagId,
        memberId,
      );

      res.status(201).json({
        success: true,
        data: { assignment },
        error: null,
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Removes a tag assignment from a customer profile.
   *
   * @http DELETE /api/v1/businesses/:businessId/customers/:customerId/tags/:tagId
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :customerId (UUID)
   *   - :tagId (UUID)
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('customer.update')
   *          -> CustomerController.unassignTag
   *          -> UnassignCustomerTagUseCase.execute
   *          -> CustomerTagRepository.unassignTag
   *
   * @returns 200 OK { success: true, data: { unassigned: true }, meta: {} }
   * @throws 404 Not Found
   */
  async unassignTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId } = getTenantContext(req);
      const customerId = getUuidParam(req, 'customerId');
      const tagId = getUuidParam(req, 'tagId');

      await this.unassignCustomerTagUseCase.execute(businessId, customerId, tagId);

      res.status(200).json({
        success: true,
        data: { unassigned: true },
        error: null,
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  }
}
