// Browser-local persistence for demo mode using localforage (IndexedDB) with memory fallback.

import localforage from 'localforage'
import type { Customer, Loan, Payment, Due, Notification, LoanAsset } from '../types'

const VERSION = 'v1'
const prefix = (key: string) => `pawntrack-demo-${VERSION}:${key}`

// In-memory fallback map for environments without IndexedDB/WebStorage (e.g. Node test runners)
const memoryFallback = new Map<string, unknown>()

interface StorageAdapter {
  getItem<T>(key: string): Promise<T | null>
  setItem<T>(key: string, value: T): Promise<T>
  removeItem(key: string): Promise<void>
  clear(): Promise<void>
}

function createAdapter(name: string, storeName: string): StorageAdapter {
  const lf = typeof window !== 'undefined' ? localforage.createInstance({ name, storeName }) : null
  return {
    async getItem<T>(key: string) {
      if (lf) return lf.getItem<T>(key)
      return structuredClone(memoryFallback.get(storeName + ':' + key) ?? null) as T | null
    },
    async setItem<T>(key: string, value: T) {
      if (lf) return lf.setItem(key, value)
      memoryFallback.set(storeName + ':' + key, structuredClone(value))
      return value
    },
    async removeItem(key) {
      if (lf) await lf.removeItem(key)
      memoryFallback.delete(storeName + ':' + key)
    },
    async clear() {
      if (lf) await lf.clear()
      for (const key of memoryFallback.keys()) {
        if (key.startsWith(storeName + ':')) memoryFallback.delete(key)
      }
    },
  }
}

// Separate stores for structured data vs media blobs
const dataStore = createAdapter('pawntrack-demo', 'data')
const mediaStore = createAdapter('pawntrack-demo', 'media')
const sessionStore = createAdapter('pawntrack-demo', 'session')

// ---------- Generic helpers ----------

async function getCollection<T>(key: string): Promise<T[]> {
  return (await dataStore.getItem<T[]>(prefix(key))) || []
}

async function setCollection<T>(key: string, data: T[]): Promise<void> {
  await dataStore.setItem(prefix(key), data)
}

// ---------- Session ----------

export async function getDemoSession(): Promise<{ userId: string; email: string } | null> {
  try {
    return await sessionStore.getItem<{ userId: string; email: string }>(prefix('session'))
  } catch {
    return null
  }
}

export async function setDemoSession(session: { userId: string; email: string } | null): Promise<void> {
  if (session) {
    await sessionStore.setItem(prefix('session'), session)
  } else {
    await sessionStore.removeItem(prefix('session'))
  }
}

// ---------- Initialization flag ----------

export async function isInitialized(): Promise<boolean> {
  try {
    return !!(await dataStore.getItem<boolean>(prefix('initialized')))
  } catch {
    return false
  }
}

export async function markInitialized(): Promise<void> {
  await dataStore.setItem(prefix('initialized'), true)
}

// ---------- Data accessors ----------

export interface Ledger {
  loans: Loan[]
  dues: Due[]
  payments: Payment[]
}

export async function readLedger(): Promise<Ledger> {
  const existing = await dataStore.getItem<Ledger>(prefix('ledger'))
  if (existing) return existing
  // Read pre-upgrade collections until the first atomic snapshot is committed.
  return { loans: await getCollection<Loan>('loans'), dues: await getCollection<Due>('dues'),
    payments: await getCollection<Payment>('payments') }
}

let pending = Promise.resolve()
export function editLedger<T>(apply: (ledger: Ledger) => T): Promise<T> {
  const commit = async () => {
    const ledger = await readLedger()
    const result = apply(ledger)
    await dataStore.setItem(prefix('ledger'), ledger)
    return result
  }
  const work = pending.then(() => typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request('pawntrack-demo-ledger', commit) : commit())
  pending = work.then(() => undefined, () => undefined)
  return work
}

export const db = {
  customers: {
    getAll: () => getCollection<Customer>('customers'),
    setAll: (data: Customer[]) => setCollection('customers', data),
  },
  notifications: {
    getAll: () => getCollection<Notification>('notifications'),
    setAll: (data: Notification[]) => setCollection('notifications', data),
  },
  loanAssets: {
    getAll: () => getCollection<LoanAsset>('loanAssets'),
    setAll: (data: LoanAsset[]) => setCollection('loanAssets', data),
  },
}

// ---------- Media / Blob storage ----------

export const media = {
  async store(key: string, blob: Blob): Promise<void> {
    await mediaStore.setItem(key, blob)
  },
  async get(key: string): Promise<Blob | null> {
    try {
      return await mediaStore.getItem<Blob>(key)
    } catch {
      return null
    }
  },
  async remove(key: string): Promise<void> {
    await mediaStore.removeItem(key)
  },
  async clear(): Promise<void> {
    await mediaStore.clear()
  },
}

// ---------- Full reset ----------

export async function clearAllDemoData(): Promise<void> {
  await dataStore.clear()
  await mediaStore.clear()
  // Keep session intact — the caller can decide whether to clear it
}
