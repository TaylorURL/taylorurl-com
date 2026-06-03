/**
 * Server-Sent Events writer for streaming responses back to the client.
 * Each event is a single JSON payload on a `data:` line, separated by \n\n.
 */
export class SseWriter {
  private encoder = new TextEncoder()
  private controller: ReadableStreamDefaultController<Uint8Array>

  constructor(controller: ReadableStreamDefaultController<Uint8Array>) {
    this.controller = controller
  }

  send(event: Record<string, unknown>): void {
    const payload = `data: ${JSON.stringify(event)}\n\n`
    this.controller.enqueue(this.encoder.encode(payload))
  }

  close(): void {
    this.controller.close()
  }
}

export const sseHeaders = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
}
