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

  it('authenticates demo user', async () => {
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

  it('lists seed customers, loans, payments, and dues', async () => {
    const customers = await provider.customers.list(orgId)
    expect(customers.length).toBeGreaterThanOrEqual(5)

    const loans = await provider.loans.list(orgId)
    expect(loans.length).toBeGreaterThanOrEqual(5)

    const payments = await provider.payments.list(orgId)
    expect(payments.length).toBeGreaterThanOrEqual(5)

    const dues = await provider.dues.list(orgId)
    expect(dues.length).toBeGreaterThanOrEqual(5)
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

  it('supports full loan CRUD and cascade cleanup', async () => {
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
      start_date: '2026-01-01',
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

    await provider.loans.update(loan.id, { status: 'closed' })
    const updated = await provider.loans.get(loan.id)
    expect(updated?.status).toBe('closed')

    await provider.loans.remove(loan.id)
    const deleted = await provider.loans.get(loan.id)
    expect(deleted).toBeNull()
  })

  it('resets demo data cleanly back to seed', async () => {
    const initialCustomers = await provider.customers.list(orgId)
    const c = await provider.customers.create({
      org_id: orgId,
      name: 'Disposable Customer',
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
