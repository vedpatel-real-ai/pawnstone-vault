import { timingSafeEqual } from 'node:crypto'

interface Settings {
  secret?: string
  url?: string
  serviceKey?: string
}

export function duesHandler(settings: Settings, run: (url: string, key: string) => Promise<unknown>) {
  const reply = (status: number, message: string) => Response.json({ message }, { status })
  return async (req: Request) => {
    if (req.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } })
    const { secret, url, serviceKey } = settings
    if (!secret || !/^[a-f0-9]{64}$/.test(secret) || !url || !serviceKey) return reply(503, 'Scheduler unavailable')
    const credential = req.headers.get('x-scheduler-secret') ?? ''
    if (!/^[a-f0-9]{64}$/.test(credential) ||
        !timingSafeEqual(new TextEncoder().encode(secret), new TextEncoder().encode(credential))) {
      return reply(401, 'Unauthorized')
    }
    // No request parameters. The scheduler always uses the database clock.
    if (req.body) {
      const reader = req.body.getReader()
      try {
        const { done } = await reader.read()
        if (!done) {
          await reader.cancel()
          return reply(400, 'Expected an empty body')
        }
      } catch {
        return reply(400, 'Invalid request body')
      }
    }
    try {
      return Response.json(await run(url, serviceKey))
    } catch {
      return reply(500, 'Dues job failed')
    }
  }
}
