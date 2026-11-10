export type ErrorCode =
  | "VALIDATION"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "POLICY"
  | "STATE";

export class DomainError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string; code: ErrorCode };

export function actionError(error: unknown): { ok: false; error: string; code: ErrorCode } {
  if (error instanceof DomainError) {
    return { ok: false, error: error.message, code: error.code };
  }
  if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002") {
    return {
      ok: false,
      error: "That slot was just taken by another student. Please choose another time.",
      code: "CONFLICT",
    };
  }
  console.error(error);
  return {
    ok: false,
    error: "Something went wrong. Please try again.",
    code: "VALIDATION",
  };
}
