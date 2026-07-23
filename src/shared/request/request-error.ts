export interface RequestErrorDetails {
  status?: number
  code?: number
  traceId?: string
  cause?: unknown
}

export class RequestError extends Error {
  readonly status?: number
  readonly code?: number
  readonly traceId?: string
  readonly cause?: unknown

  constructor(message: string, details: RequestErrorDetails = {}) {
    super(message)
    this.name = 'RequestError'
    this.status = details.status
    this.code = details.code
    this.traceId = details.traceId
    this.cause = details.cause
  }
}

export function isUnauthorizedRequestError(error: unknown) {
  if (error instanceof RequestError && (error.status === 401 || error.code === 401)) {
    return true
  }

  const message = error instanceof Error ? error.message : String(error ?? '')
  return message.includes('登录状态') || message.includes('401')
}

export function isAbortedRequestError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const candidate = error as { code?: string; name?: string; cause?: unknown }
  if (candidate.code === 'ERR_CANCELED' || candidate.name === 'CanceledError') {
    return true
  }

  if (candidate.cause) {
    return isAbortedRequestError(candidate.cause)
  }

  return false
}
