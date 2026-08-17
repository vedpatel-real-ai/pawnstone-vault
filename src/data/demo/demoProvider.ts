// Demo data provider — fully browser-local, no network requests.
// Implements the DataProvider interface using IndexedDB via localforage.

import type { DataProvider } from '../dataProvider'
import type { Customer, Loan, Payment, Due, Notification, LoanAsset, AppSession } from '../types'
import { db, media, getDemoSession, setDemoSession, isInitialized, markInitialized, clearAllDemoData } from './demoStorage'
import { createSeedData, getDemoOrgId } from './demoSeed'
import { calculateMonthlyInterest } from '@/lib/interest'
import { format, addMonths, parseISO, isBefore } from 'date-fns'

const DEMO_USER = { id: 'demo-user-0001', email: 'demo@pawntrack.app' }

// Object URL cache to prevent leaks
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

// Generate any missing monthly dues for active loans (idempotent)
async function generateDuesForOrg(orgId: string): Promise<void> {
  const loans = (await db.loans.getAll()).filter(l => l.org_id === orgId && (l.status === 'active' || l.status === 'overdue'))
  const allDues = await db.dues.getAll()
  const now = new Date()
  const newDues: Due[] = []

  for (const loan of loans) {
    const startDate = parseISO(loan.start_date)
    // Generate dues up to and including current month
    let dueMonth = addMonths(startDate, 1)
    while (isBefore(dueMonth, addMonths(now, 1))) {
      const dueDateStr = format(dueMonth, 'yyyy-MM-dd')
      // Idempotency: check for existing due for this loan/date/type
      const exists = allDues.some(d => d.loan_id === loan.id && d.due_date === dueDateStr && d.due_type === 'interest')
      if (!exists && !newDues.some(d => d.loan_id === loan.id && d.due_date === dueDateStr && d.due_type === 'interest')) {
        const amount = calculateMonthlyInterest(loan.remaining_principal, loan.interest_rate_percent)
        const status = isBefore(dueMonth, now) ? 'overdue' : 'pending'
        newDues.push({
          id: `demo-due-gen-${loan.id}-${dueDateStr}`,
          org_id: orgId,
          loan_id: loan.id,
          due_date: dueDateStr,
          amount,
          due_type: 'interest',
          status: status as Due['status'],
          created_at: new Date().toISOString(),
        })
      }
      dueMonth = addMonths(dueMonth, 1)
    }
  }

  if (newDues.length > 0) {
    await db.dues.setAll([...allDues, ...newDues])
  }
}

export function createDemoProvider(): DataProvider {
  // Ensure initialization on first use
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
        return (await db.customers.getAll()).filter(c => c.org_id === orgId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      },
      async get(id: string) {
        await ensureInit()
        return (await db.customers.getAll()).find(c => c.id === id) || null
      },
      async create(data) {
        await ensureInit()
        const customer: Customer = { ...data, id: `demo-customer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, created_at: new Date().toISOString() }
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
        await db.customers.setAll((await db.customers.getAll()).filter(c => c.id !== id))
        // Cascade: remove related loans, payments, dues
        const loans = (await db.loans.getAll()).filter(l => l.customer_id === id)
        const loanIds = new Set(loans.map(l => l.id))
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
        return (await db.loans.getAll()).filter(l => l.org_id === orgId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      },
      async get(id: string) {
        await ensureInit()
        return (await db.loans.getAll()).find(l => l.id === id) || null
      },
      async create(data) {
        await ensureInit()
        const loan: Loan = { ...data, id: `demo-loan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
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
        return (await db.payments.getAll()).filter(p => p.org_id === orgId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      },
      async create(data) {
        await ensureInit()
        const payment: Payment = { ...data, id: `demo-payment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, created_at: new Date().toISOString() }
        await db.payments.setAll([...(await db.payments.getAll()), payment])
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
        const due: Due = { ...data, id: `demo-due-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, created_at: new Date().toISOString() }
        await db.dues.setAll([...(await db.dues.getAll()), due])
        return due
      },
    },

    // --- Notifications ---
    notifications: {
      async list(orgId: string) {
        await ensureInit()
        return (await db.notifications.getAll()).filter(n => n.org_id === orgId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      },
      async create(data) {
        await ensureInit()
        const notif: Notification = { ...data, id: `demo-notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, created_at: new Date().toISOString() }
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
        const asset: LoanAsset = { ...data, id: `demo-asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, created_at: new Date().toISOString() }
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
      async upload(_bucket: string, path: string, file: File | Blob, _options?: { upsert?: boolean; contentType?: string }): Promise<string> {
        await ensureInit()
        const key = `demo-media:${path}`
        await media.store(key, file)
        return key // return the storage key as "url"
      },
      async getUrl(_bucket: string, path: string): Promise<string> {
        const key = path.startsWith('demo-media:') ? path : `demo-media:${path}`
        const blob = await media.get(key)
        if (!blob) return '/placeholder.svg'
        revokeTrackedUrl(key)
        const url = URL.createObjectURL(blob)
        objectUrlCache.set(key, url)
        return url
      },
      async remove(_bucket: string, paths: string[]): Promise<void> {
        for (const p of paths) {
          const key = p.startsWith('demo-media:') ? p : `demo-media:${p}`
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
      // Re-initialize with seed data
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
