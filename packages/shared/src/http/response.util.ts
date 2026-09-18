/**
 * The project-wide SUCCESS response envelope.
 *
 * Every successful endpoint answers with the same four fields:
 *   { success: true, data, error: null, meta }
 *
 * WHY THIS HELPER EXISTS: the envelope was previously hand-written at every call site, and that
 * is exactly how `error` went missing from four of the identity module's five endpoints — while
 * the OpenAPI schema published for those same endpoints declared `error` as `nullable()`. The API
 * was contradicting its own contract, and nothing could catch it, because TypeScript never sees
 * the JSON that actually leaves the process. The same drift happened once before in the staff
 * module (see docs/99-history/BUGS_REPORT-monolithic.md). Centralising the shape turns "the
 * envelope is complete" from a habit someone must remember into a property of the code.
 *
 * WHY `error` IS ALWAYS NULL HERE: a client can then decide whether a request failed by testing
 * the single field `body.error`, without first checking which endpoint answered. In JavaScript,
 * `undefined === null` is false — so an omitted field does not merely look different, it actively
 * breaks that check on the client.
 *
 * WHY THE PARAMETER IS STRUCTURAL: `@salon/shared` deliberately has no runtime dependencies, so
 * this file must not import Express. Express's `Response` satisfies `JsonResponder` structurally,
 * which means callers pass `res` directly while the shared package stays dependency-free.
 */

/** The smallest shape of an Express-like response this helper actually needs. */
export interface JsonResponder {
  status(code: number): { json(body: unknown): unknown };
}

/** Optional trailing metadata (pagination totals, request ids for tracing, ...). */
export type ResponseMeta = Record<string, unknown>;

/**
 * Sends a success response in the standard envelope.
 *
 * @param res         the Express response (or anything structurally compatible)
 * @param statusCode  e.g. 200 for OK, 201 for Created
 * @param data        the payload; pass `null` when the endpoint has nothing to return
 * @param meta        trailing metadata, defaults to `{}`
 */
export function respondOk<TData>(
  res: JsonResponder,
  statusCode: number,
  data: TData,
  meta: ResponseMeta = {},
): void {
  res.status(statusCode).json({
    success: true,
    data,
    error: null,
    meta,
  });
}
