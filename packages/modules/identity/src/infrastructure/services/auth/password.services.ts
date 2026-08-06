import bcrypt from 'bcrypt';
import type { IPasswordService } from '../../../application/ports/password-service.port.js';

export class BcryptPasswordService implements IPasswordService {
  // 12 rounds is the current OWASP industry standard for bcrypt.
  // It provides a perfect balance between security (slow to crack) and performance (fast to log in).
  private readonly saltRounds = 12;

  /**
   * Hashes a plain-text password securely.
   */
  async hash(password: string): Promise<string> {
    return await bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Compares a plain-text password attempt against the database hash.
   */
  async compare(plainText: string, hashed: string): Promise<boolean> {
    return await bcrypt.compare(plainText, hashed);
  }
}

// Naive approach: Hashing the password directly inside the Express controller.
// If you ever switch from bcrypt to argon2, you have to rewrite your HTTP routes.

// Enterprise approach: We wrap the cryptography in a dedicated class.
// The rest of the application just calls .hash() and .compare().
