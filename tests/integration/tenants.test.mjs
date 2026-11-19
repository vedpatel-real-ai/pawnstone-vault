import { before, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { actor, admin, guest, ok, originate } from './local.mjs'

let a, b, loan
before(async () => {
  a = await actor()
  b = await actor()
  loan = await originate(b)
  assert.notEqual(a.org,b.org)
})

test('membership belongs to the authenticated identity and survives concurrent initialization', async () => {
  assert.equal(ok(await b.client.rpc('create_org_for_current_user')),b.org)
  assert.ok((await guest.rpc('create_org_for_current_user')).error)
  assert.ok((await a.client.from('profiles').update({org_id:b.org}).eq('id',a.user.id)).error)
  assert.ok((await a.client.rpc('assign_user_to_org',{p_user_id:a.user.id,p_org_id:b.org})).error)
})

test('two organizations see and mutate only their authorized rows', async () => {
  const samples = {
    customers: b.customer, loans: loan, profiles: {id:b.user.id}, organizations:{id:b.org},
    dues:ok(await admin.from('dues').insert({org_id:b.org,loan_id:loan.id,due_date:'2024-02-15',due_type:'interest',amount:3}).select().single()),
    payments:ok(await admin.from('payments').insert({org_id:b.org,loan_id:loan.id,amount:1,type:'other'}).select().single()),
    notifications:ok(await b.client.from('notifications').insert({org_id:b.org,loan_id:loan.id,title:'Fixture'}).select().single()),
    loan_assets:ok(await b.client.from('loan_assets').insert({org_id:b.org,loan_id:loan.id,file_url:loan.id+'/x',file_name:'x'}).select().single()),
    audit_logs:ok(await admin.from('audit_logs').insert({org_id:b.org,action:'fixture'}).select().single()),
  }
  for (const [table,row] of Object.entries(samples)) {
    assert.equal(ok(await b.client.from(table).select('id').eq('id',row.id)).length,1,table)
    assert.deepEqual(ok(await a.client.from(table).select('id').eq('id',row.id)),[],table)
    const update = await a.client.from(table).update(table === 'customers' ? {name:'Changed'} : {id:row.id}).eq('id',row.id).select()
    assert.ok(update.error || update.data.length === 0,table)
    const removal = await a.client.from(table).delete().eq('id',row.id).select()
    assert.ok(removal.error || removal.data.length === 0,table)
    const insert = await a.client.from(table).insert({...row,id:randomUUID()})
    assert.ok(insert.error,table)
    assert.equal(ok(await b.client.from(table).select('id').eq('id',row.id)).length,1,table)
  }
  await assert.rejects(originate(a,{customer_id:b.customer.id}))
  assert.ok((await a.client.from('notifications').insert({org_id:a.org,loan_id:loan.id,title:'Invalid link'})).error)
  assert.ok((await a.client.from('loan_assets').insert({org_id:a.org,loan_id:loan.id,file_url:loan.id+'/x',file_name:'x'})).error)
  assert.ok((await b.client.from('customers').delete().eq('id',b.customer.id)).error)
})

test('private storage scopes upload, sign, update and removal to the parent row', async () => {
  for (const [bucket,parent] of [['customers',b.customer.id],['loan_assets',loan.id]]) {
    const own = b.client.storage.from(bucket), other = a.client.storage.from(bucket)
    const path = parent+'/synthetic.txt'
    ok(await own.upload(path,new Blob(['fixture'])))
    if (bucket==='customers') {
      const customer = ok(await b.client.from('customers').insert({name:'Synthetic media only'}).select().single())
      const object = customer.id+'/fixture.txt'
      ok(await own.upload(object,new Blob(['fixture'])))
      assert.ok((await b.client.from('customers').delete().eq('id',customer.id)).error)
      ok(await own.remove([object]))
      ok(await b.client.from('customers').delete().eq('id',customer.id).select().single())
    }
    ok(await own.update(path,new Blob(['updated'])))
    assert.ok((await other.upload(parent+'/foreign.txt',new Blob(['fixture']))).error)
    assert.ok((await other.update(path,new Blob(['changed']))).error)
    assert.ok((await other.createSignedUrl(path,30)).error)
    await other.remove([path])
    const signed = ok(await own.createSignedUrl(path,30))
    assert.equal(await (await fetch(signed.signedUrl)).text(),'updated')
    ok(await own.remove([path]))
    assert.ok((await own.download(path)).error)
  }
})
