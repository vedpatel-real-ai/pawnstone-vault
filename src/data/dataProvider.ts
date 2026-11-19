// Data provider interface — the abstraction layer between UI and persistence.
// Both DemoProvider and SupabaseProvider implement this interface.

import type {
  Customer, Loan, Payment, Due, Notification, LoanAsset, AppSession,
} from './types'

export interface DataProvider {
  // Auth
  getSession(): Promise<AppSession | null>
  signIn(email: string, password: string): Promise<{ session: AppSession | null; error: string | null }>
  signOut(): Promise<void>
  onAuthStateChange(callback: (session: AppSession | null) => void): () => void

  // Customers
  customers: {
    list(orgId: string): Promise<Customer[]>
    get(id: string): Promise<Customer | null>
    create(data: Omit<Customer, 'id' | 'created_at'>): Promise<Customer>
    update(id: string, data: Partial<Customer>): Promise<void>
    remove(id: string): Promise<void>
  }

  // Loans
  loans: {
    list(orgId: string): Promise<Loan[]>
    get(id: string): Promise<Loan | null>
    create(data: Omit<Loan, 'id' | 'created_at' | 'updated_at'>): Promise<Loan>
    update(id: string, data: Partial<Loan>): Promise<void>
    remove(id: string): Promise<void>
  }

  // Payments
  payments: {
    list(orgId: string): Promise<Payment[]>
    create(data: Omit<Payment, 'id' | 'created_at'> & { request_id: string }): Promise<Payment>
  }

  // Dues
  dues: {
    list(orgId: string): Promise<Due[]>
  }

  // Notifications
  notifications: {
    list(orgId: string): Promise<Notification[]>
    create(data: Omit<Notification, 'id' | 'created_at'>): Promise<Notification>
  }

  // Loan Assets
  loanAssets: {
    list(loanId: string): Promise<LoanAsset[]>
    add(data: Omit<LoanAsset, 'id' | 'created_at'>): Promise<LoanAsset>
    remove(id: string): Promise<void>
  }

  // Media/Storage
  storage: {
    upload(bucket: string, path: string, file: File | Blob, options?: { upsert?: boolean; contentType?: string }): Promise<string>
    getUrl(bucket: string, path: string): Promise<string>
    remove(bucket: string, paths: string[]): Promise<void>
  }

  // Org
  getOrgId(userId: string): Promise<string | null>

  // Demo-specific (no-ops for Supabase)
  generateDues?(orgId: string): Promise<void>
  resetDemoData?(): Promise<void>
}

export function isDemo(): boolean {
  const mode = import.meta.env.VITE_DATA_MODE
  if (mode === 'supabase') return false
  if (mode === 'demo') return true
  // Default: demo if no supabase URL is configured
  const url = import.meta.env.VITE_SUPABASE_URL
  return !url || url === '' || url === 'https://placeholder.supabase.co'
}
