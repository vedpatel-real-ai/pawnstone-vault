// Demo data provider — fully browser-local, no network requests.
// Implements the DataProvider interface using IndexedDB via localforage.

import type { DataProvider } from '../dataProvider'
import type { Customer, Loan, Payment, Due, Notification, LoanAsset, AppSession } from '../types'
import { db, media, getDemoSession, setDemoSession, isInitialized, markInitialized, clearAllDemoData } from './demoStorage'
import { createSeedData, getDemoOrgId } from './demoSeed'
import { calculateMonthlyInterest } from '@/lib/interest'
import { format, addMonths, parseISO, isBefore, startOfDay } from 'date-fns'

const DEMO_USER = { id: 'demo-user-0001', email: 'demo@pawntrack.app' }

// Object URL cache to prevent memory leaks
const objectUrlCache = new Map<string, string>()

function revokeTrackedUrl(key: string) {
  const existing = objectUrlCache.get(key)
  if (existing) {
    URL.revokeObjectURL(existing)
    objectUrlCache.delete(key)
  }
}

async function initialize(): Promise<void> {
  if (await isInitialized()) return
  const seed = createSeedData()
  await db.customers.setAll(seed.customers)
  await db.loans.setAll(seed.loans)
  await db.payments.setAll(seed.payments)
  await db.dues.setAll(seed.dues)
  await db.notifications.setAll(seed.notifications)
  await db.loanAssets.setAll(seed.loanAssets)
  await markInitialized()
}

// Auth state change listeners
let authListeners: Array<(session: AppSession | null) => void> = []

function notifyAuthListeners(session: AppSession | null) {
  authListeners.forEach(cb => cb(session))
}

// Generate any missing monthly dues for active/overdue loans and mark past dues as overdue (idempotent)
async function generateDuesForOrg(orgId: string): Promise<void> {
  const allLoans = await db.loans.getAll()
  const loans = allLoans.filter(l => l.org_id === orgId && (l.status === 'active' || l.status === 'overdue'))
  const allDues = await db.dues.getAll()
  const now = new Date()
  const todayStr = format(now, 'yyyy-MM-dd')
  let duesChanged = false

  // 1. Transition past pending dues to overdue (never revert paid/cancelled)
  const updatedDues = allDues.map(due => {
    if (due.org_id === orgId && due.status === 'pending' && due.due_date < todayStr) {
      duesChanged = true
      return { ...due, status: 'overdue' as const }
    }
    return due
  })

  // 2. Generate missing monthly dues up to current month horizon
  const newDues: Due[] = []

  for (const loan of loans) {
    const startDate = parseISO(loan.start_date)
    let dueMonth = addMonths(startDate, 1)
    const horizon = addMonths(now, 1)

    while (isBefore(dueMonth, horizon)) {
      const dueDateStr = format(dueMonth, 'yyyy-MM-dd')
      const existsInCurrent = updatedDues.some(d => d.loan_id === loan.id && d.due_date === dueDateStr && d.due_type === 'interest')
      const existsInNew = newDues.some(d => d.loan_id === loan.id && d.due_date === dueDateStr && d.due_type === 'interest')

      if (!existsInCurrent && !existsInNew) {
        const amount = calculateMonthlyInterest(loan.remaining_principal, loan.interest_rate_percent)
        const isPast = isBefore(startOfDay(dueMonth), startOfDay(now))
        const status: Due['status'] = isPast ? 'overdue' : 'pending'

        newDues.push({
          id: `demo-due-gen-${loan.id}-${dueDateStr}`,
          org_id: orgId,
          loan_id: loan.id,
          due_date: dueDateStr,
          amount,
          due_type: 'interest',
          status,
          created_at: new Date().toISOString(),
        })
        duesChanged = true
      }
      dueMonth = addMonths(dueMonth, 1)
    }
  }

  if (duesChanged) {
    await db.dues.setAll([...updatedDues, ...newDues])
  }
}

export function createDemoProvider(): DataProvider {
  const initPromise = initialize()

  async function ensureInit() {
    await initPromise
  }

  const provider: DataProvider = {
    // --- Auth ---
    async getSession(): Promise<AppSession | null> {
      await ensureInit()
      const s = await getDemoSession()
      if (!s) return null
      return { user: { id: s.userId, email: s.email } }
    },

    async signIn(email: string, password: string) {
      await ensureInit()
      if (email === 'demo@pawntrack.app' && password === 'demo123') {
        await setDemoSession({ userId: DEMO_USER.id, email: DEMO_USER.email })
        const session: AppSession = { user: DEMO_USER }
        notifyAuthListeners(session)
        return { session, error: null }
      }
      return { session: null, error: 'Invalid demo credentials. Use demo@pawntrack.app / demo123' }
    },

    async signOut() {
      await setDemoSession(null)
      notifyAuthListeners(null)
    },

    onAuthStateChange(callback: (session: AppSession | null) => void): () => void {
      authListeners.push(callback)
      return () => {
        authListeners = authListeners.filter(cb => cb !== callback)
      }
    },

    // --- Customers ---
    customers: {
      async list(orgId: string) {
        await ensureInit()
        return (await db.customers.getAll())
          .filter(c => c.org_id === orgId)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      },
      async get(id: string) {
        await ensureInit()
        return (await db.customers.getAll()).find(c => c.id === id) || null
      },
      async create(data) {
        await ensureInit()
        const customer: Customer = {
          ...data,
          id: `demo-customer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          created_at: new Date().toISOString(),
        }
        const all = await db.customers.getAll()
        await db.customers.setAll([...all, customer])
        return customer
      },
      async update(id, data) {
        await ensureInit()
        const all = await db.customers.getAll()
        const idx = all.findIndex(c => c.id === id)
        if (idx >= 0) {
          all[idx] = { ...all[idx], ...data }
          await db.customers.setAll(all)
        }
      },
      async remove(id) {
        await ensureInit()
        const customer = (await db.customers.getAll()).find(c => c.id === id)
        if (customer) {
          if (customer.profile_photo_url) {
            revokeTrackedUrl(customer.profile_photo_url)
            await media.remove(customer.profile_photo_url)
          }
          if (customer.id_proof_url) {
            revokeTrackedUrl(customer.id_proof_url)
            await media.remove(customer.id_proof_url)
          }
        }

        await db.customers.setAll((await db.customers.getAll()).filter(c => c.id !== id))

        // Cascade: remove related loans, payments, dues, and loan assets
        const loans = (await db.loans.getAll()).filter(l => l.customer_id === id)
        const loanIds = new Set(loans.map(l => l.id))

        // Remove media for all customer's loan assets
        const allAssets = await db.loanAssets.getAll()
        for (const a of allAssets) {
          if (loanIds.has(a.loan_id)) {
            revokeTrackedUrl(a.file_url)
            await media.remove(a.file_url)
          }
        }

        await db.loans.setAll((await db.loans.getAll()).filter(l => l.customer_id !== id))
        await db.payments.setAll((await db.payments.getAll()).filter(p => !loanIds.has(p.loan_id)))
        await db.dues.setAll((await db.dues.getAll()).filter(d => !loanIds.has(d.loan_id)))
        await db.loanAssets.setAll((await db.loanAssets.getAll()).filter(a => !loanIds.has(a.loan_id)))
      },
    },

    // --- Loans ---
    loans: {
      async list(orgId: string) {
        await ensureInit()
        return (await db.loans.getAll())
          .filter(l => l.org_id === orgId)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      },
      async get(id: string) {
        await ensureInit()
        return (await db.loans.getAll()).find(l => l.id === id) || null
      },
      async create(data) {
        await ensureInit()
        const loan: Loan = {
          ...data,
          id: `demo-loan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        await db.loans.setAll([...(await db.loans.getAll()), loan])
        return loan
      },
      async update(id, data) {
        await ensureInit()
        const all = await db.loans.getAll()
        const idx = all.findIndex(l => l.id === id)
        if (idx >= 0) {
          all[idx] = { ...all[idx], ...data, updated_at: new Date().toISOString() }
          await db.loans.setAll(all)
        }
      },
      async remove(id) {
        await ensureInit()
        await db.loans.setAll((await db.loans.getAll()).filter(l => l.id !== id))
        await db.payments.setAll((await db.payments.getAll()).filter(p => p.loan_id !== id))
        await db.dues.setAll((await db.dues.getAll()).filter(d => d.loan_id !== id))

        // Remove loan assets and their media
        const assets = (await db.loanAssets.getAll()).filter(a => a.loan_id === id)
        for (const a of assets) {
          revokeTrackedUrl(a.file_url)
          await media.remove(a.file_url)
        }
        await db.loanAssets.setAll((await db.loanAssets.getAll()).filter(a => a.loan_id !== id))
      },
    },

    // --- Payments ---
    payments: {
      async list(orgId: string) {
        await ensureInit()
        return (await db.payments.getAll())
          .filter(p => p.org_id === orgId)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      },
      async create(data) {
        await ensureInit()
        const payment: Payment = {
          ...data,
          id: `demo-payment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          created_at: new Date().toISOString(),
        }

        // 1. Save payment
        await db.payments.setAll([...(await db.payments.getAll()), payment])

        // 2. Synchronize loan state and dues based on payment type
        const allLoans = await db.loans.getAll()
        const loanIdx = allLoans.findIndex(l => l.id === payment.loan_id)

        if (loanIdx >= 0) {
          const loan = allLoans[loanIdx]

          if (payment.type === 'principal') {
            const newPrincipal = Math.max(0, Number(loan.remaining_principal || 0) - Number(payment.amount))
            const isFullyPaid = newPrincipal === 0
            const updatedStatus = isFullyPaid ? 'closed' : loan.status

            allLoans[loanIdx] = {
              ...loan,
              remaining_principal: newPrincipal,
              status: updatedStatus,
              updated_at: new Date().toISOString(),
            }
            await db.loans.setAll(allLoans)
          } else if (payment.type === 'interest') {
            // Settle oldest unpaid due (overdue first, then pending)
            const allDues = await db.dues.getAll()
            const unpaidDues = allDues
              .filter(d => d.loan_id === loan.id && (d.status === 'overdue' || d.status === 'pending'))
              .sort((a, b) => a.due_date.localeCompare(b.due_date))

            if (unpaidDues.length > 0) {
              const dueToSettle = unpaidDues[0]
              const dueIdx = allDues.findIndex(d => d.id === dueToSettle.id)
              if (dueIdx >= 0) {
                allDues[dueIdx] = { ...allDues[dueIdx], status: 'paid' }
                await db.dues.setAll(allDues)
              }
            }

            // Check if any overdue dues remain for this loan
            const remainingOverdue = (await db.dues.getAll()).filter(
              d => d.loan_id === loan.id && d.status === 'overdue'
            )

            // If no overdue dues remain, check if loan was overdue solely due to missed dues
            if (remainingOverdue.length === 0 && loan.status === 'overdue') {
              const todayStr = format(new Date(), 'yyyy-MM-dd')
              const isPastMaturity = loan.due_date ? loan.due_date < todayStr : false
              if (!isPastMaturity) {
                allLoans[loanIdx] = {
                  ...loan,
                  status: 'active',
                  updated_at: new Date().toISOString(),
                }
                await db.loans.setAll(allLoans)
              }
            }
          }
        }

        return payment
      },
    },

    // --- Dues ---
    dues: {
      async list(orgId: string) {
        await ensureInit()
        return (await db.dues.getAll()).filter(d => d.org_id === orgId)
      },
      async update(id, data) {
        await ensureInit()
        const all = await db.dues.getAll()
        const idx = all.findIndex(d => d.id === id)
        if (idx >= 0) {
          all[idx] = { ...all[idx], ...data }
          await db.dues.setAll(all)
        }
      },
      async create(data) {
        await ensureInit()
        const due: Due = {
          ...data,
          id: `demo-due-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          created_at: new Date().toISOString(),
        }
        await db.dues.setAll([...(await db.dues.getAll()), due])
        return due
      },
    },

    // --- Notifications ---
    notifications: {
      async list(orgId: string) {
        await ensureInit()
        return (await db.notifications.getAll())
          .filter(n => n.org_id === orgId)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      },
      async create(data) {
        await ensureInit()
        const notif: Notification = {
          ...data,
          id: `demo-notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          created_at: new Date().toISOString(),
        }
        await db.notifications.setAll([...(await db.notifications.getAll()), notif])
        return notif
      },
    },

    // --- Loan Assets ---
    loanAssets: {
      async list(loanId: string) {
        await ensureInit()
        return (await db.loanAssets.getAll()).filter(a => a.loan_id === loanId)
      },
      async add(data) {
        await ensureInit()
        const asset: LoanAsset = {
          ...data,
          id: `demo-asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          created_at: new Date().toISOString(),
        }
        await db.loanAssets.setAll([...(await db.loanAssets.getAll()), asset])
        return asset
      },
      async remove(id) {
        await ensureInit()
        const all = await db.loanAssets.getAll()
        const asset = all.find(a => a.id === id)
        if (asset) {
          revokeTrackedUrl(asset.file_url)
          await media.remove(asset.file_url)
        }
        await db.loanAssets.setAll(all.filter(a => a.id !== id))
      },
    },

    // --- Storage ---
    storage: {
      async upload(bucket: string, path: string, file: File | Blob, _options?: { upsert?: boolean; contentType?: string }): Promise<string> {
        await ensureInit()
        const key = path.startsWith('demo-media:') ? path : `demo-media:${bucket}/${path}`
        await media.store(key, file)
        return key
      },
      async getUrl(bucket: string, path: string): Promise<string> {
        if (!path || path === '' || path === '/placeholder.svg') return '/placeholder.svg'
        if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) {
          return path
        }
        const key = path.startsWith('demo-media:') ? path : `demo-media:${bucket}/${path}`
        const blob = await media.get(key)
        if (!blob) return '/placeholder.svg'
        revokeTrackedUrl(key)
        const url = URL.createObjectURL(blob)
        objectUrlCache.set(key, url)
        return url
      },
      async remove(bucket: string, paths: string[]): Promise<void> {
        for (const p of paths) {
          const key = p.startsWith('demo-media:') ? p : `demo-media:${bucket}/${p}`
          revokeTrackedUrl(key)
          await media.remove(key)
        }
      },
    },

    // --- Org ---
    async getOrgId(_userId: string): Promise<string | null> {
      await ensureInit()
      return getDemoOrgId()
    },

    // --- Demo-specific ---
    async generateDues(orgId: string): Promise<void> {
      await ensureInit()
      await generateDuesForOrg(orgId)
    },

    async resetDemoData(): Promise<void> {
      await clearAllDemoData()
      // Revoke all tracked object URLs
      objectUrlCache.forEach((_url, key) => revokeTrackedUrl(key))
      // Re-initialize with fresh seed data
      const seed = createSeedData()
      await db.customers.setAll(seed.customers)
      await db.loans.setAll(seed.loans)
      await db.payments.setAll(seed.payments)
      await db.dues.setAll(seed.dues)
      await db.notifications.setAll(seed.notifications)
      await db.loanAssets.setAll(seed.loanAssets)
      await markInitialized()
    },
  }

  return provider
}
