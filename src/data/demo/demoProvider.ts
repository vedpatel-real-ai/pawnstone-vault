// Demo data provider — fully browser-local, no network requests.
// Implements the DataProvider interface using IndexedDB via localforage.

import type { DataProvider } from '../dataProvider'
import type { Customer, Loan, Payment, Due, Notification, LoanAsset, AppSession } from '../types'
import { readLedger, editLedger, db, media, getDemoSession, setDemoSession, isInitialized, markInitialized, clearAllDemoData } from './demoStorage'
import { createSeedData, getDemoOrgId } from './demoSeed'
import { assess, issueDue, postDemoPayment } from './ledger'
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
  await editLedger(ledger => Object.assign(ledger, { loans:seed.loans, dues:seed.dues, payments:seed.payments }))
  await db.notifications.setAll(seed.notifications)
  await db.loanAssets.setAll(seed.loanAssets)
  await markInitialized()
}

// Auth state change listeners
let authListeners: Array<(session: AppSession | null) => void> = []

function notifyAuthListeners(session: AppSession | null) {
  authListeners.forEach(cb => cb(session))
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
        if ((await readLedger()).loans.some(l => l.customer_id === id)) throw Error('Customer has loan history')
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


      },
    },

    // --- Loans ---
    loans: {
      async list(orgId: string) {
        await ensureInit()
        return ((await readLedger()).loans)
          .filter(l => l.org_id === orgId)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      },
      async get(id: string) {
        await ensureInit()
        return ((await readLedger()).loans).find(l => l.id === id) || null
      },
      async create(data) {
        await ensureInit()
        const loan: Loan = {
          ...data,
          id: `demo-loan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        if (!(loan.loan_amount > 0) || !Number.isFinite(loan.loan_amount) ||
            !(loan.interest_rate_percent >= 0) || !Number.isFinite(loan.interest_rate_percent) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(loan.start_date) ||
            loan.start_date > new Date().toISOString().slice(0,10)) throw Error('Invalid loan terms')
        if (!(await db.customers.getAll()).some(c => c.id === loan.customer_id && c.org_id === loan.org_id)) throw Error('Unknown borrower')
        loan.remaining_principal = loan.loan_amount
        loan.status = 'active'
        loan.next_due_date = format(addMonths(parseISO(loan.start_date),1),'yyyy-MM-dd')
        return editLedger(ledger => {
          ledger.loans.push(loan)
          issueDue(ledger, loan, loan.next_due_date)
          return loan
        })
      },
      async update(id, data) {
        const allowed = ['asset_type','asset_description','asset_value','term_months','due_date','notes']
        if (Object.keys(data).some(k => !allowed.includes(k))) throw Error('Financial terms are immutable')
        await editLedger(ledger => {
          const loan = ledger.loans.find(l => l.id === id)
          if (!loan) throw Error('Loan unavailable')
          Object.assign(loan,data,{ updated_at: new Date().toISOString() })
        })
      },
      async remove() { throw Error('Loan history is retained') },
    },

    // --- Payments ---
    payments: {
      async list(orgId: string) {
        await ensureInit()
        return ((await readLedger()).payments)
          .filter(p => p.org_id === orgId)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      },
      async create(data) {
        await ensureInit()
        return editLedger(ledger => postDemoPayment(ledger,data))
      },
    },

    // --- Dues ---
    dues: {
      async list(orgId: string) {
        await ensureInit()
        return ((await readLedger()).dues).filter(d => d.org_id === orgId)
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
      await editLedger(ledger => {
        const today = new Date().toISOString().slice(0,10)
        for (const loan of ledger.loans.filter(l => l.org_id === orgId)) assess(ledger,loan,today)
      })
    },

    async resetDemoData(): Promise<void> {
      await ensureInit()
      await clearAllDemoData()
      // Revoke all tracked object URLs
      objectUrlCache.forEach((_url, key) => revokeTrackedUrl(key))
      // Re-initialize with fresh seed data
      const seed = createSeedData()
      await db.customers.setAll(seed.customers)
      await editLedger(ledger => Object.assign(ledger, { loans:seed.loans, dues:seed.dues, payments:seed.payments }))
      await db.notifications.setAll(seed.notifications)
      await db.loanAssets.setAll(seed.loanAssets)
      await markInitialized()
    },
  }

  return provider
}
