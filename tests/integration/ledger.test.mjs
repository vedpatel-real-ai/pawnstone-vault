import { before, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { actor, ok, originate } from './local.mjs'

let shop
before(async () => { shop = await actor() })
const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const loan = () => originate(shop,{start_date:today})
function post(l,amount,type,request = randomUUID(),client = shop.client) {
  return client.rpc('post_payment',{p_loan:l.id,p_request:request,p_amount:amount,p_type:type,p_notes:'Fixture'})
}
const balance = async l => ok(await shop.client.from('loans').select('*').eq('id',l.id).single())
const dues = async l => ok(await shop.client.from('dues').select('*').eq('loan_id',l.id).order('due_date'))
test('concurrent ₹100 and ₹200 receipts against ₹1,000 leave ₹700', async () => {
  const l = await loan()
  const receipts = (await Promise.all([post(l,100,'principal'),post(l,200,'principal')])).map(ok)
  assert.notEqual(receipts[0].id,receipts[1].id)
  assert.equal((await balance(l)).remaining_principal,700)
  assert.equal(ok(await shop.client.from('payments').select('id').eq('loan_id',l.id)).length,2)
})
test('₹1 against ₹20 leaves ₹19 and settlement waits for both balances', async () => {
  const l = await loan()
  ok(await post(l,1,'interest'))
  const [d] = await dues(l)
  assert.equal(d.amount-d.paid_amount,19)
  assert.equal(d.status,'pending')
  ok(await post(l,1000,'principal'))
  assert.equal((await balance(l)).status,'active')
  ok(await post(l,19,'interest'))
  assert.equal((await balance(l)).status,'closed')
  assert.equal((await dues(l))[0].status,'paid')
})
test('concurrent retries return the same receipt and changed terms fail', async () => {
  const l = await loan(), key = randomUUID()
  const [a,b] = (await Promise.all([post(l,100,'principal',key),post(l,100,'principal',key)])).map(ok)
  assert.equal(a.id,b.id)
  assert.equal(a.posted_by,shop.user.id)
  assert.ok((await post(l,101,'principal',key)).error)
  assert.equal((await balance(l)).remaining_principal,900)
})
test('invalid, excessive and foreign collections leave receipts and allocations untouched', async () => {
  const l = await loan(), other = await actor()
  for (const amount of [0,-1,0.001,1001]) assert.ok((await post(l,amount,'principal')).error)
  assert.ok((await post(l,21,'interest')).error)
  assert.ok((await post(l,1,'principal',randomUUID(),other.client)).error)
  assert.equal((await balance(l)).remaining_principal,1000)
  assert.equal((await dues(l))[0].paid_amount,0)
  assert.equal(ok(await shop.client.from('payments').select('id').eq('loan_id',l.id)).length,0)
  assert.ok((await shop.client.from('loans').update({remaining_principal:0}).eq('id',l.id)).error)
})
test('backlogged invoices use anchored calendar dates and FIFO allocation', async () => {
  const l = await originate(shop)
  ok(await post(l,21.25,'interest'))
  const [feb,mar] = await dues(l)
  assert.deepEqual([feb.due_date,mar.due_date],['2024-02-29','2024-03-31'])
  assert.deepEqual([feb.paid_amount,mar.paid_amount],[20,1.25])
  assert.equal(feb.status,'paid')
  assert.equal(mar.status,'overdue')
})
