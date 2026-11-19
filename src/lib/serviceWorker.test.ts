import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { it, expect, vi } from 'vitest'

function worker() {
  const events = new Map()
  const caches = { keys: async () => ['pawntrack-cache-v1','unrelated'], delete:vi.fn(), open:vi.fn() }
  runInNewContext(readFileSync('public/sw.js','utf8'),{
    URL, caches, self:{location:{origin:'https://app.test'},clients:{claim:vi.fn()},addEventListener:(name,fn)=>events.set(name,fn)},
  })
  return { events,caches }
}
it('retires the old cache before taking control and preserves unrelated caches',async () => {
  const {events,caches} = worker()
  let finished
  events.get('activate')({waitUntil:p=>{finished=p}})
  await finished
  expect(caches.delete.mock.calls).toEqual([['pawntrack-cache-v1']])
})
it('passes private API, signed media and authorization-dependent requests through',() => {
  const {events,caches} = worker()
  const respondWith = vi.fn()
  for (const path of ['/auth/v1/user','/rest/v1/payments','/storage/v1/object/sign/customers/a?token=fixture','https://external.test/index.html','/index.html?token=fixture']) {
    events.get('fetch')({request:new Request(new URL(path,'https://app.test')),respondWith})
  }
  events.get('fetch')({request:new Request('https://app.test/index.html',{headers:{Authorization:'fixture'}}),respondWith})
  expect(respondWith).not.toHaveBeenCalled()
  expect(caches.open).not.toHaveBeenCalled()
})
