export type ErrorCode =
  | 'INVALID_URL' | 'UNSUPPORTED_URL' | 'INVALID_IDENTIFIER' | 'ITEM_NOT_FOUND'
  | 'ITEM_UNAVAILABLE' | 'METADATA_REQUEST_FAILED' | 'FILE_LIST_FAILED'
  | 'FILE_NOT_FOUND' | 'FILE_RESTRICTED' | 'AUTHENTICATION_REQUIRED'
  | 'UPSTREAM_TIMEOUT' | 'UPSTREAM_CONNECTION_FAILED' | 'RANGE_NOT_SUPPORTED'
  | 'DOWNLOAD_INTERRUPTED' | 'DOWNLOAD_FAILED' | 'RATE_LIMITED' | 'BAD_REQUEST';

export class AppError extends Error {
  constructor(public readonly code: ErrorCode, message: string, public readonly status = 400, public readonly cause?: unknown) {
    super(message);
    this.name = 'AppError';
  }
}

export function asAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Error && error.name === 'AbortError') return new AppError('UPSTREAM_TIMEOUT', 'The Internet Archive request timed out.', 504, error);
  return new AppError('DOWNLOAD_FAILED', 'The Internet Archive request could not be completed.', 502, error);
}
