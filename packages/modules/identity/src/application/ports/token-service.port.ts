export interface TokenPayload {
  userId: string;
  email: string;
}

export interface ITokenService {
  generateAccessToken(payload: TokenPayload): string; // NEW: opaque random string
  generateRefreshToken(): string;
  hashRefreshToken(token: string): string; // NEW: SHA-256
  verifyToken(token: string): TokenPayload;
}
