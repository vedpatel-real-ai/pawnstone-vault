import { it, expect, vi } from 'vitest'
import { deliverClaimed } from '../../supabase/functions/generate-dues/mail'

it('records provider acceptance, rejection and uncertain delivery separately', async () => {
  const send = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockRejectedValueOnce(Error())
  const record = vi.fn()
  await deliverClaimed(['a','b','c'].map(id => ({notice_id:id,recipient:'fixture@example.invalid',message:'fixture'})), send, record)
  expect(record.mock.calls).toEqual([['a','accepted'],['b','rejected'],['c','unknown']])
})
