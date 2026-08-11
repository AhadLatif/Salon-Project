import jwt from 'jsonwebtoken';

export interface TestJwtPayload {
  userId: string;
  email: string;
  role?: string;
  [key: string]: unknown;
}

const DEFAULT_TEST_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-1234567890';

/**
 * Generates a signed JWT access token for test requests.
 */
export function generateTestJwtToken(
  payload: TestJwtPayload,
  secret: string = DEFAULT_TEST_SECRET,
): string {
  return jwt.sign(payload, secret, { expiresIn: '1h' });
}

/**
 * Returns an HTTP header object with Bearer token authentication.
 */
export function createAuthHeader(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}
