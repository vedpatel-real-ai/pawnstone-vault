import { describe, expect, it, vi } from 'vitest'
import { duesHandler } from '../../supabase/functions/generate-dues/handler'

describe('scheduler entrypoint', () => {
  const secret = 'a'.repeat(64)
  const settings = { secret, url: 'http://localhost', serviceKey: 'synthetic' }
  it.each([
    ['GET', undefined, undefined, 405], ['POST', undefined, undefined, 401],
    ['POST', 'publishable-key', undefined, 401], ['POST', 'b'.repeat(64), undefined, 401],
    ['POST', secret, '{}', 400],
  ] as const)('rejects request %s (%#) before any privileged work', async (method, token, body, status) => {
    const run = vi.fn()
    const response = await duesHandler(settings, run)(new Request(settings.url, {
      method, headers: token ? { 'x-scheduler-secret': token } : {}, body,
    }))
    expect(response.status).toBe(status)
    expect(run).not.toHaveBeenCalled()
    expect(await response.text()).not.toContain(secret)
  })
  it('requires complete server configuration', async () => {
    const run = vi.fn()
    for (const field of Object.keys(settings)) {
      const response = await duesHandler({ ...settings, [field]: undefined }, run)(new Request(settings.url, { method: 'POST' }))
      expect(response.status).toBe(503)
    }
    expect(run).not.toHaveBeenCalled()
  })
  it('runs an authenticated job and redacts internal errors', async () => {
    const request = () => new Request(settings.url, { method: 'POST', headers: { 'x-scheduler-secret': secret } })
    const run = vi.fn().mockResolvedValueOnce({ generated: 1 }).mockRejectedValueOnce(new Error(secret))
    expect(await (await duesHandler(settings, run)(request())).json()).toEqual({ generated: 1 })
    const failure = await duesHandler(settings, run)(request())
    expect(failure.status).toBe(500)
    expect(await failure.text()).not.toContain(secret)
  })
})
