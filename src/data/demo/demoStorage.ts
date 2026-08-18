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
  let lf: LocalForage | null = null
  try {
    lf = localforage.createInstance({ name, storeName })
  } catch {
    lf = null
  }

  return {
    async getItem<T>(key: string): Promise<T | null> {
      if (lf) {
        try {
          const val = await lf.getItem<T>(key)
          if (val !== null && val !== undefined) return val
        } catch {
          // fall through to memory fallback
        }
      }
      return memoryFallback.get(`${storeName}:${key}`) ?? null
    },
    async setItem<T>(key: string, value: T): Promise<T> {
      memoryFallback.set(`${storeName}:${key}`, value)
      if (lf) {
        try {
          await lf.setItem(key, value)
        } catch {
          // memory fallback already set
        }
      }
      return value
    },
    async removeItem(key: string): Promise<void> {
      memoryFallback.delete(`${storeName}:${key}`)
      if (lf) {
        try {
          await lf.removeItem(key)
        } catch {
          // ignore
        }
      }
    },
    async clear(): Promise<void> {
      for (const k of Array.from(memoryFallback.keys())) {
        if (k.startsWith(`${storeName}:`)) {
          memoryFallback.delete(k)
        }
      }
      if (lf) {
        try {
          await lf.clear()
        } catch {
          // ignore
        }
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
  try {
    return (await dataStore.getItem<T[]>(prefix(key))) || []
  } catch {
    return []
  }
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

export const db = {
  customers: {
    getAll: () => getCollection<Customer>('customers'),
    setAll: (data: Customer[]) => setCollection('customers', data),
  },
  loans: {
    getAll: () => getCollection<Loan>('loans'),
    setAll: (data: Loan[]) => setCollection('loans', data),
  },
  payments: {
    getAll: () => getCollection<Payment>('payments'),
    setAll: (data: Payment[]) => setCollection('payments', data),
  },
  dues: {
    getAll: () => getCollection<Due>('dues'),
    setAll: (data: Due[]) => setCollection('dues', data),
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
