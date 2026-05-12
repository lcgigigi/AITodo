export interface SseOptions {
  headers?: Record<string, string>
  onMessage: (event: MessageEvent) => void
  onError?: (event: Event) => void
}

export function createSseConnection(url: string, options: SseOptions) {
  const source = new EventSource(url)

  source.onmessage = options.onMessage
  source.onerror = options.onError || null

  return source
}
