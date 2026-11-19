import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { actor, admin, guest, ok, originate } from './local.mjs'

const run = async () => ok(await admin.rpc('generate_scheduled_dues'))
test('job RPCs are restricted and parallel runs retain unique periods and notices', async () => {
  const shop = await actor()
  for (const client of [shop.client,guest]) {
    for (const rpc of ['claim_due_mail','generate_scheduled_dues']) assert.ok((await client.rpc(rpc)).error)
  }
  const loan = await originate(shop)
  await Promise.all([run(),run()])
  await run()
  const dues = ok(await shop.client.from('dues').select('*').eq('loan_id',loan.id))
  const notices = ok(await shop.client.from('notifications').select('*').eq('loan_id',loan.id))
  assert.ok(dues.length>2)
  assert.equal(new Set(dues.map(d=>d.due_date)).size,dues.length)
  assert.equal(new Set(notices.map(n=>n.due_id)).size,dues.length)
  assert.equal(notices.length,dues.length)
  assert.ok(dues.some(d=>d.due_date==='2025-02-28'))
})

test('a failed due insert leaves schedule and notices intact, then retry catches up', async () => {
  const shop = await actor(), loan = await originate(shop)
  // Fault only this synthetic loan in the dedicated CLI container.
  assert.match(loan.id,/^[0-9a-f-]{36}$/)
  const sql = statement => execFileSync('docker',['exec','supabase_db_pawntrack-local','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c',statement],{stdio:'pipe'})
  sql(`alter table public.dues add constraint fixture_insert_failure check(loan_id <> '${loan.id}' or due_date='2024-02-29') not valid`)
  try {
    assert.ok((await admin.rpc('generate_scheduled_dues')).error)
    assert.equal(ok(await shop.client.from('loans').select('next_due_date').eq('id',loan.id).single()).next_due_date,loan.next_due_date)
    assert.deepEqual(ok(await shop.client.from('notifications').select('id').eq('loan_id',loan.id)),[])
  } finally { sql('alter table public.dues drop constraint fixture_insert_failure') }
  await run()
  assert.ok(ok(await shop.client.from('loans').select('next_due_date').eq('id',loan.id).single()).next_due_date>loan.next_due_date)
})

test('one worker claims each eligible email without contacting a mail service', async () => {
  const shop = await actor()
  ok(await shop.client.from('customers').update({email:'fixture@example.invalid'}).eq('id',shop.customer.id))
  const loan = await originate(shop)
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
  const due = ok(await admin.from('dues').upsert({org_id:shop.org,loan_id:loan.id,due_date:today,due_type:'interest',amount:20},{onConflict:'loan_id,due_date,due_type'}).select().single())
  const n = ok(await admin.from('notifications').insert({org_id:shop.org,loan_id:loan.id,due_id:due.id,title:'Fixture'}).select().single())
  const claims = (await Promise.all([admin.rpc('claim_due_mail'),admin.rpc('claim_due_mail')])).flatMap(ok)
  assert.equal(claims.filter(c=>c.notice_id===n.id).length,1)
  assert.equal(ok(await admin.rpc('claim_due_mail')).filter(c=>c.notice_id===n.id).length,0)
})
