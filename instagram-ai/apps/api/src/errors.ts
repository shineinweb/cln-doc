export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}

export function notFound(message = 'Not found'): ApiError {
  return new ApiError(404, 'not_found', message)
}

export function forbidden(message = 'You do not have permission to do that'): ApiError {
  return new ApiError(403, 'forbidden', message)
}
