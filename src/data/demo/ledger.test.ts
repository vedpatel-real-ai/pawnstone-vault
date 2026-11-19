import { businessDate } from '@/lib/businessDate'
import { beforeEach, expect,it } from 'vitest'
import { createDemoProvider } from './demoProvider'
import { getDemoOrgId } from './demoSeed'
import { calculateMonthlyInterest } from '@/lib/interest'

const provider = createDemoProvider()
const org = getDemoOrgId()
const today = businessDate()
beforeEach(() => provider.resetDemoData!())
async function originate() {
  const [c] = await provider.customers.list(org)
  return provider.loans.create({ org_id:org,customer_id:c.id,loan_amount:1000,remaining_principal:1000,interest_rate_percent:2,
    start_date:today,next_due_date:today,term_months:12,due_date:null,asset_description:null,asset_type:null,
    asset_value:null,last_interest_calculated:null,notes:null,status:'active' })
}
it('serializes concurrent demo paydowns and recognizes a retried receipt',async () => {
  const loan = await originate()
  const receipt = {org_id:org,loan_id:loan.id,type:'principal' as const,amount:100,notes:null,payment_date:today,request_id:crypto.randomUUID()}
  const [first,second,retry] = await Promise.all([provider.payments.create(receipt),provider.payments.create({...receipt,amount:200,request_id:crypto.randomUUID()}),provider.payments.create(receipt)])
  expect(first.id).toBe(retry.id)
  expect(first.id).not.toBe(second.id)
  expect((await provider.loans.get(loan.id))?.remaining_principal).toBe(700)
  expect((await provider.payments.list(org)).filter(p=>p.loan_id===loan.id)).toHaveLength(2)
})
it('retains partial interest and rolls back a rejected excess allocation',async () => {
  const loan = await originate()
  const receipt = {org_id:org,loan_id:loan.id,type:'interest' as const,amount:1,notes:null,payment_date:today,request_id:crypto.randomUUID()}
  await provider.payments.create(receipt)
  await expect(provider.payments.create({...receipt,amount:20,request_id:crypto.randomUUID()})).rejects.toThrow()
  const due = (await provider.dues.list(org)).find(d=>d.loan_id===loan.id)!
  expect(due.amount - due.paid_amount!).toBe(19)
  expect(due.status).toBe('pending')
})
it('rounds monthly interest to the nearest paise, half up',() => {
  expect(calculateMonthlyInterest(1,0.5)).toBe(0.01)
  expect(calculateMonthlyInterest(100000,2)).toBe(2000)
  expect(calculateMonthlyInterest(90000,2)).toBe(1800)
})
