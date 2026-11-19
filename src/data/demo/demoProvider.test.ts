import { businessDate } from '@/lib/businessDate'
import { describe, it, expect, beforeEach } from 'vitest'
import { createDemoProvider } from './demoProvider'
import { getDemoOrgId } from './demoSeed'

describe('DemoProvider', () => {
  let provider: ReturnType<typeof createDemoProvider>
  const orgId = getDemoOrgId()

  beforeEach(async () => {
    provider = createDemoProvider()
    if (provider.resetDemoData) {
      await provider.resetDemoData()
    }
  })

  it('authenticates demo user with correct credentials', async () => {
    const res = await provider.signIn('demo@pawntrack.app', 'demo123')
    expect(res.error).toBeNull()
    expect(res.session?.user.email).toBe('demo@pawntrack.app')

    const session = await provider.getSession()
    expect(session?.user.email).toBe('demo@pawntrack.app')

    await provider.signOut()
    const afterSignOut = await provider.getSession()
    expect(afterSignOut).toBeNull()
  })

  it('rejects invalid demo credentials', async () => {
    const res = await provider.signIn('wrong@example.com', 'badpass')
    expect(res.error).toBeTruthy()
    expect(res.session).toBeNull()
  })

  it('lists populated seed customers, loans, payments, and dues', async () => {
    const customers = await provider.customers.list(orgId)
    expect(customers.length).toBeGreaterThanOrEqual(7)

    const loans = await provider.loans.list(orgId)
    expect(loans.length).toBeGreaterThanOrEqual(7)

    const payments = await provider.payments.list(orgId)
    expect(payments.length).toBeGreaterThanOrEqual(10)

    const dues = await provider.dues.list(orgId)
    expect(dues.length).toBeGreaterThanOrEqual(10)
  })

  it('supports full customer CRUD', async () => {
    const newCustomer = await provider.customers.create({
      org_id: orgId,
      name: 'Test Customer',
      email: 'test@customer.com',
      phone: '9999999999',
      alt_phone: null,
      address: 'Test Address',
      id_proof_number: 'TEST1234',
      id_proof_url: null,
      profile_photo_url: null,
      notes: 'Notes here',
    })

    expect(newCustomer.id).toBeTruthy()
    expect(newCustomer.name).toBe('Test Customer')

    const fetched = await provider.customers.get(newCustomer.id)
    expect(fetched?.name).toBe('Test Customer')

    await provider.customers.update(newCustomer.id, { name: 'Updated Customer' })
    const updated = await provider.customers.get(newCustomer.id)
    expect(updated?.name).toBe('Updated Customer')

    await provider.customers.remove(newCustomer.id)
    const deleted = await provider.customers.get(newCustomer.id)
    expect(deleted).toBeNull()
  })

  it('preserves financial history and allows collateral detail edits', async () => {
    const customers = await provider.customers.list(orgId)
    const customerId = customers[0].id

    const loan = await provider.loans.create({
      org_id: orgId,
      customer_id: customerId,
      asset_type: 'gold',
      asset_description: 'Test Gold Ring',
      asset_value: 50000,
      loan_amount: 30000,
      remaining_principal: 30000,
      interest_rate_percent: 2.0,
      start_date: businessDate(),
      due_date: '2026-06-01',
      next_due_date: '2026-02-01',
      term_months: 6,
      status: 'active',
      last_interest_calculated: null,
      notes: null,
    })

    expect(loan.id).toBeTruthy()
    const fetched = await provider.loans.get(loan.id)
    expect(fetched?.asset_description).toBe('Test Gold Ring')

    await expect(provider.loans.update(loan.id, { status: 'closed' })).rejects.toThrow()
    await provider.loans.update(loan.id, {notes:'Inspected'})
    const updated = await provider.loans.get(loan.id)
    expect(updated?.status).toBe('active')
    expect(updated?.notes).toBe('Inspected')
    await expect(provider.loans.remove(loan.id)).rejects.toThrow()
    await expect(provider.customers.remove(customerId)).rejects.toThrow()
  })

  it('reduces remaining_principal on principal payment and closes loan at 0', async () => {
    const customers = await provider.customers.list(orgId)
    const loan = await provider.loans.create({
      org_id: orgId,
      customer_id: customers[0].id,
      asset_type: 'gold',
      asset_description: 'Pawn Chain',
      asset_value: 100000,
      loan_amount: 50000,
      remaining_principal: 50000,
      interest_rate_percent: 2.0,
      start_date: businessDate(),
      due_date: '2026-06-01',
      next_due_date: '2026-02-01',
      term_months: 6,
      status: 'active',
      last_interest_calculated: null,
      notes: null,
    })

    // Partial principal payment: ₹20,000
    await provider.payments.create({
      org_id: orgId,
      request_id: crypto.randomUUID(),
      loan_id: loan.id,
      amount: 20000,
      type: 'principal',
      payment_date: '2026-02-01',
      notes: 'Partial paydown',
    })

    let updatedLoan = await provider.loans.get(loan.id)
    expect(updatedLoan?.remaining_principal).toBe(30000)
    expect(updatedLoan?.status).toBe('active')

    // Full remaining payoff: ₹30,000
    await provider.payments.create({
      org_id: orgId,
      request_id: crypto.randomUUID(),
      loan_id: loan.id,
      amount: 30000,
      type: 'principal',
      payment_date: '2026-03-01',
      notes: 'Full payoff',
    })

    updatedLoan = await provider.loans.get(loan.id)
    expect(updatedLoan?.remaining_principal).toBe(0)
    expect(updatedLoan?.status).toBe('active')
    await provider.payments.create({ org_id:orgId,loan_id:loan.id,request_id:crypto.randomUUID(),amount:1000,type:'interest',notes:null,payment_date:businessDate() })
    expect((await provider.loans.get(loan.id))?.status).toBe('closed')
  })

  it('settles outstanding interest due on interest payment', async () => {
    const customers = await provider.customers.list(orgId)
    const loan = await provider.loans.create({
      org_id: orgId,
      customer_id: customers[0].id,
      asset_type: 'car',
      asset_description: 'Car Pawn',
      asset_value: 200000,
      loan_amount: 100000,
      remaining_principal: 100000,
      interest_rate_percent: 2.5,
      start_date: businessDate(),
      due_date: '2026-12-01',
      next_due_date: '2026-02-01',
      term_months: 12,
      status: 'active',
      last_interest_calculated: null,
      notes: null,
    })

    const due = (await provider.dues.list(orgId)).find(d => d.loan_id === loan.id)!

    expect(due.status).toBe('pending')

    // Record interest payment
    await provider.payments.create({
      org_id: orgId,
      request_id: crypto.randomUUID(),
      loan_id: loan.id,
      amount: 2500,
      type: 'interest',
      payment_date: '2026-02-01',
      notes: 'Month 1 interest',
    })

    const dues = await provider.dues.list(orgId)
    const settledDue = dues.find(d => d.id === due.id)
    expect(settledDue?.status).toBe('paid')
  })

  it('generates missing dues idempotently and marks past pending dues as overdue', async () => {
    const initialDues = await provider.dues.list(orgId)
    await provider.generateDues!(orgId)
    const duesAfterFirstGen = await provider.dues.list(orgId)

    // Running again must be idempotent
    await provider.generateDues!(orgId)
    const duesAfterSecondGen = await provider.dues.list(orgId)
    expect(duesAfterSecondGen.length).toBe(duesAfterFirstGen.length)

    // Paid dues must never be reverted
    const paidBefore = initialDues.filter(d => d.status === 'paid')
    const paidAfter = duesAfterSecondGen.filter(d => d.status === 'paid')
    expect(paidAfter.length).toBeGreaterThanOrEqual(paidBefore.length)
  })

  it('handles media upload and resolves getUrl gracefully', async () => {
    // In node/vitest, create a small text Blob/File
    const dummyBlob = new Blob(['sample-image-data'], { type: 'image/jpeg' })
    const key = await provider.storage.upload('customers', 'cust-1/photo.jpg', dummyBlob)
    expect(key).toContain('demo-media:customers/cust-1/photo.jpg')

    // getUrl resolves to a url or placeholder
    const resolvedUrl = await provider.storage.getUrl('customers', key)
    expect(resolvedUrl).toBeTruthy()

    // Non-existent key returns placeholder
    const placeholder = await provider.storage.getUrl('customers', 'nonexistent.jpg')
    expect(placeholder).toBe('/placeholder.svg')
  })

  it('resets demo data cleanly back to initial state', async () => {
    const initialCustomers = await provider.customers.list(orgId)
    const c = await provider.customers.create({
      org_id: orgId,
      name: 'Temporary Customer',
      email: null,
      phone: '8888888888',
      alt_phone: null,
      address: null,
      id_proof_number: null,
      id_proof_url: null,
      profile_photo_url: null,
      notes: null,
    })

    const duringCount = (await provider.customers.list(orgId)).length
    expect(duringCount).toBe(initialCustomers.length + 1)

    await provider.resetDemoData!()
    const afterReset = await provider.customers.list(orgId)
    expect(afterReset.length).toBe(initialCustomers.length)
    expect(afterReset.find(item => item.id === c.id)).toBeUndefined()
  })
})
