export class AttendanceError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AttendanceError";
  }
}

export const badRequest = (message: string, code = "BAD_REQUEST") => new AttendanceError(400, code, message);
export const unauthorized = (message = "Unauthorized", code = "UNAUTHORIZED") =>
  new AttendanceError(401, code, message);
export const forbidden = (message = "Forbidden", code = "FORBIDDEN") => new AttendanceError(403, code, message);
export const notFound = (message = "Not found", code = "NOT_FOUND") => new AttendanceError(404, code, message);
export const conflict = (message: string, code = "CONFLICT") => new AttendanceError(409, code, message);
export const locked = (message: string, code = "MONTH_LOCKED") => new AttendanceError(423, code, message);
export const tooMany = (message: string, code = "RATE_LIMITED") => new AttendanceError(429, code, message);
