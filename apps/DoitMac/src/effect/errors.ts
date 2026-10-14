import { Data } from 'effect';

export class AuthError extends Data.TaggedError('AuthError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class TodoTransportError extends Data.TaggedError('TodoTransportError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class TodoHttpError extends Data.TaggedError('TodoHttpError')<{
  readonly status: number;
  readonly message: string;
}> {}

export class TodoDecodeError extends Data.TaggedError('TodoDecodeError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class TodoValidationError extends Data.TaggedError(
  'TodoValidationError',
)<{
  readonly message: string;
}> {}

export type AppError =
  | AuthError
  | TodoTransportError
  | TodoHttpError
  | TodoDecodeError
  | TodoValidationError;

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.length > 0) return error;
  return 'Something went wrong. Please try again.';
}
