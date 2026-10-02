export interface TokenPayload {
  userId: string;
  email: string;
}

/**
 * The narrowest capability an *authenticator* needs: check a token, learn who it belongs to.
 *
 * This is deliberately smaller than `ITokenService`. A middleware that can only verify a
 * token must not also be able to mint one — exposing `generateAccessToken` /
 * `generateRefreshToken` / `hashRefreshToken` to a public, anonymous-capable middleware
 * would hand credential-issuing power to code that has no business holding it
 * (Interface Segregation: depend on what you use, not on what exists).
 */
export interface ITokenVerifier {
  verifyToken(token: string): TokenPayload;
}

/** The full capability set, needed only inside the Identity module (login, register, refresh, logout). */
export interface ITokenService extends ITokenVerifier {
  generateAccessToken(payload: TokenPayload): string; // NEW: opaque random string
  generateRefreshToken(): string;
  hashRefreshToken(token: string): string; // NEW: SHA-256
}
