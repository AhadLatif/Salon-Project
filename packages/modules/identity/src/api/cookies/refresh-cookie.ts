import type { CookieOptions } from 'express';
/**
 * REFRESH COOKIE CONTRACT
 *
 * These values are the wire contract the web client is built against, so they live in the
 * API layer (cookies are an HTTP transport detail, not a business rule) and are exported
 * rather than inlined into the controller.
 */
/**
 * Cookie name. Namespaced on purpose: cookies are identified by (name, domain, path) and
 * IGNORE the port, so in local development the web app and the API share one jar on
 * `localhost`. A generic name like `refreshToken` could collide with a cookie the web app
 * sets for itself; a product-namespaced name cannot.
 */
export const REFRESH_COOKIE_NAME = 'salon_refresh_token';
/**
 * Only the auth endpoints ever read this cookie (`/refresh`, `/logout`), so scoping it here
 * keeps it off every other request — less noise, and no CSRF surface on state-changing APIs.
 */
export const REFRESH_COOKIE_PATH = '/api/v1/auth';
export type RuntimeEnvironment = 'development' | 'test' | 'production';
/**
 * Attributes shared by the "set" and "clear" variants.
 *
 * A cookie is identified by (name, domain, path), so the SAME attributes must be used when
 * clearing it — otherwise `clearCookie` targets a cookie that does not exist and the browser
 * happily keeps the original one.
 */
function baseCookieAttributes(environment: RuntimeEnvironment): CookieOptions {
  return {
    // JavaScript (and therefore any XSS payload) cannot read an HttpOnly cookie. This is
    // the single most important property here: it is what stops a stolen refresh token.
    httpOnly: true,
    // `Secure` cookies are only accepted over HTTPS. Forcing it in local development would
    // make the browser silently DROP the cookie and the refresh flow would look broken, so
    // it is tied to the environment. Any deployment behind TLS (staging, production) must
    // therefore run with NODE_ENV=production.
    secure: environment === 'production',
    // `Lax` (not `Strict`): the cookie still travels on top-level navigations to our app
    // (link clicks, reloads), while cross-site POSTs — the classic CSRF vector — do not get
    // to use it. `Strict` would break the "reopen the app and stay signed in" flow.
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
  };
}
/** Attributes for issuing a refresh cookie. */
export function buildRefreshCookieOptions(
  environment: RuntimeEnvironment,
  maxAge: number,
): CookieOptions {
  return {
    ...baseCookieAttributes(environment),
    maxAge,
  };
}
/** Attributes for clearing the refresh cookie (no `maxAge`; `res.clearCookie` adds the past expiry). */
export function buildClearedRefreshCookieOptions(
  environment: RuntimeEnvironment,
  _maxAge: number,
): CookieOptions {
  return baseCookieAttributes(environment);
}
