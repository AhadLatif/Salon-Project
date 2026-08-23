import { db } from '@salon/database';
import { ResourceNotFoundError, ValidationError } from '@salon/shared';
import {
  createTestBusiness,
  createTestBusinessMember,
  createTestCustomer,
  truncateAllTables,
} from '@salon/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AddCustomerNoteUseCase } from '../src/application/use-cases/add-customer-note.use-case.js';
import { DeleteCustomerNoteUseCase } from '../src/application/use-cases/delete-customer-note.use-case.js';
import { GetCustomerNotesUseCase } from '../src/application/use-cases/get-customer-notes.use-case.js';
import { CustomerRepository } from '../src/infrastructure/repositories/customer.repository.js';
import { CustomerNoteRepository } from '../src/infrastructure/repositories/customer-note.repository.js';

describe('Customer Notes Integration Tests', () => {
  let customerRepo: CustomerRepository;
  let noteRepo: CustomerNoteRepository;
  let addNoteUseCase: AddCustomerNoteUseCase;
  let getNotesUseCase: GetCustomerNotesUseCase;
  let deleteNoteUseCase: DeleteCustomerNoteUseCase;

  beforeEach(async () => {
    await truncateAllTables(db);
    customerRepo = new CustomerRepository(db);
    noteRepo = new CustomerNoteRepository(db);

    addNoteUseCase = new AddCustomerNoteUseCase(customerRepo, noteRepo);
    getNotesUseCase = new GetCustomerNotesUseCase(customerRepo, noteRepo);
    deleteNoteUseCase = new DeleteCustomerNoteUseCase(noteRepo);
  });

  it('should successfully add and list internal CRM notes for a customer', async () => {
    const business = await createTestBusiness(db);
    const member = await createTestBusinessMember(db, { businessId: business.id });
    const customer = await createTestCustomer(db, business.id);

    const note1 = await addNoteUseCase.execute({
      businessId: business.id,
      businessCustomerId: customer.id,
      authorId: member.id,
      note: 'First appointment note: Prefers warm water.',
    });

    const note2 = await addNoteUseCase.execute({
      businessId: business.id,
      businessCustomerId: customer.id,
      authorId: member.id,
      note: 'Second appointment note: Allergic to lavender oil.',
    });

    expect(note1.id).toBeDefined();
    expect(note1.authorId).toBe(member.id);
    expect(note2.id).toBeDefined();

    const notes = await getNotesUseCase.execute(business.id, customer.id);
    expect(notes).toHaveLength(2);
    expect(notes[0]?.note).toBe('Second appointment note: Allergic to lavender oil.'); // newest first
  });

  it('should throw ValidationError if note content is empty or whitespace', async () => {
    const business = await createTestBusiness(db);
    const customer = await createTestCustomer(db, business.id);

    await expect(
      addNoteUseCase.execute({
        businessId: business.id,
        businessCustomerId: customer.id,
        note: '   ',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('should throw ResourceNotFoundError when adding note to customer in another business (IDOR protection)', async () => {
    const businessA = await createTestBusiness(db);
    const businessB = await createTestBusiness(db);
    const customerInA = await createTestCustomer(db, businessA.id);

    await expect(
      addNoteUseCase.execute({
        businessId: businessB.id,
        businessCustomerId: customerInA.id,
        note: 'Intruder note',
      }),
    ).rejects.toThrow(ResourceNotFoundError);
  });

  it('should successfully delete a customer note', async () => {
    const business = await createTestBusiness(db);
    const customer = await createTestCustomer(db, business.id);

    const note = await addNoteUseCase.execute({
      businessId: business.id,
      businessCustomerId: customer.id,
      note: 'Note to be deleted',
    });

    const result = await deleteNoteUseCase.execute(business.id, customer.id, note.id);
    expect(result).toBe(true);

    const remaining = await getNotesUseCase.execute(business.id, customer.id);
    expect(remaining).toHaveLength(0);
  });

  it('should throw ResourceNotFoundError when deleting non-existent note', async () => {
    const business = await createTestBusiness(db);
    const customer = await createTestCustomer(db, business.id);

    await expect(
      deleteNoteUseCase.execute(business.id, customer.id, '00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow(ResourceNotFoundError);
  });
});
