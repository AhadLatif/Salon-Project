import { customerNotes, type Database } from '@salon/database';
import { and, desc, eq } from 'drizzle-orm';
import type {
  CreateCustomerNoteData,
  ICustomerNoteRepository,
} from '../../application/ports/customer-repository.port.js';
import type { CustomerNoteEntity } from '../../domain/entities/customer-note.entity.js';

export class CustomerNoteRepository implements ICustomerNoteRepository {
  constructor(private readonly db: Database) {}

  /**
   * Creates an internal CRM note for a customer profile.
   * `authorId` is bound to the verified business member.
   */
  async create(data: CreateCustomerNoteData): Promise<CustomerNoteEntity> {
    const [inserted] = await this.db
      .insert(customerNotes)
      .values({
        businessId: data.businessId,
        businessCustomerId: data.businessCustomerId,
        authorId: data.authorId ?? null,
        note: data.note.trim(),
      })
      .returning();

    return inserted as CustomerNoteEntity;
  }

  /**
   * Finds a note verifying both customer and tenant isolation boundaries.
   */
  async findById(
    businessId: string,
    customerId: string,
    noteId: string,
  ): Promise<CustomerNoteEntity | null> {
    const [note] = await this.db
      .select()
      .from(customerNotes)
      .where(
        and(
          eq(customerNotes.businessId, businessId),
          eq(customerNotes.businessCustomerId, customerId),
          eq(customerNotes.id, noteId),
        ),
      )
      .limit(1);

    return (note as CustomerNoteEntity) ?? null;
  }

  /**
   * Lists all notes for a customer profile, newest first.
   */
  async findAllByCustomerId(businessId: string, customerId: string): Promise<CustomerNoteEntity[]> {
    const notes = await this.db
      .select()
      .from(customerNotes)
      .where(
        and(
          eq(customerNotes.businessId, businessId),
          eq(customerNotes.businessCustomerId, customerId),
        ),
      )
      .orderBy(desc(customerNotes.createdAt));

    return notes as CustomerNoteEntity[];
  }

  /**
   * Deletes a specific CRM note under tenant & customer boundary.
   */
  async delete(businessId: string, customerId: string, noteId: string): Promise<boolean> {
    const [deleted] = await this.db
      .delete(customerNotes)
      .where(
        and(
          eq(customerNotes.businessId, businessId),
          eq(customerNotes.businessCustomerId, customerId),
          eq(customerNotes.id, noteId),
        ),
      )
      .returning({ id: customerNotes.id });

    return !!deleted;
  }
}
