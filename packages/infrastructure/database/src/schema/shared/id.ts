import { v7 as uuidv7 } from 'uuid';

/**
 * Generates a UUIDv7 identifier.
 *
 * Used as the default ID generator for all database entities.
 * becuase we are generating uuid7 at application level to save the one round trip from db
 */

export function generateId(): string {
  return uuidv7();
}
