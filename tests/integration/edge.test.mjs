import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { actor,admin,ok,originate,url } from './local.mjs'

test('local Edge runtime authenticates before changing financial state',async () => {
  const secret = readFileSync('.cache/scheduler.env','utf8').trim().split('=')[1]
  const shop = await actor(), loan = await originate(shop)
  const snapshot = async () => {
    const dueRows = ok(await shop.client.from('dues').select('id').eq('loan_id',loan.id))
    const notices = ok(await shop.client.from('notifications').select('id,mail_attempted_at').eq('loan_id',loan.id))
    const row = ok(await shop.client.from('loans').select('next_due_date').eq('id',loan.id).single())
    return { dueRows,notices,row }
  }
  const before = await snapshot()
  const invoke = headers => fetch(url + '/functions/v1/generate-dues',{method:'POST',headers})
  for (const headers of [{},{'x-scheduler-secret':'invalid'}]) assert.equal((await invoke(headers)).status,401)
  assert.deepEqual(await snapshot(),before)
  const response = await invoke({'x-scheduler-secret':secret})
  assert.equal(response.status,200)
  assert.ok((await response.json()).generated > 0)
  const after = await snapshot()
  assert.ok(after.dueRows.length>before.dueRows.length)
  assert.ok(after.row.next_due_date>before.row.next_due_date)
  assert.ok(after.notices.every(n=>n.mail_attempted_at === null))
  assert.equal((await invoke({'x-scheduler-secret':secret})).status,200)
  assert.deepEqual(await snapshot(),after)
})
