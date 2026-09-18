/**
 * SESSION POLICY — the single source of truth for how long a refresh session lives.
 *
 * Why this file exists:
 * A refresh session has TWO clocks that must agree:
 *  1. the database row (`user_sessions.expires_at`), enforced by the server, and
 *  2. the browser cookie (`Max-Age`), enforced by the client.
 *
 * If those drift apart the client ends up holding a cookie the server already treats
 * as dead (or throws away a cookie the server would still accept), which surfaces to
 * the user as a random logout. Keeping one constant for both removes that entire
 * class of bug — so every consumer must import this value instead of hardcoding a
 * duration.
 */

/**
 * Absolute lifetime of a refresh session: 7 days.
 *
 * Note that rotation does NOT extend this window — rotating replaces the token but
 * keeps the original expiry. That matters: otherwise an attacker who steals a token
 * could keep the session alive forever by refreshing it in a loop. Refresh tokens are
 * long-lived credentials, so a finite, revocable window bounds the blast radius of an
 * undetected theft.
 */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
