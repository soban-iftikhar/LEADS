/** An error that is safe to show: status, human sentence, optional per-field messages. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly errors: Record<string, string> | null = null,
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badInput = (errors: Record<string, string>, message = "Please check the highlighted fields.") => new AppError(422, message, errors);
export const unauthenticated = (message = "Please log in.") => new AppError(401, message);
export const notFound = (message = "Not found.") => new AppError(404, message);
export const conflict = (message: string, errors: Record<string, string> | null = null) => new AppError(409, message, errors);
export const tooMany = (retryAfterSec: number, message = "Too many tries. Try again in a little while.") =>
  new AppError(429, message, { retryAfterSec: String(retryAfterSec) }, { "Retry-After": String(retryAfterSec) });
