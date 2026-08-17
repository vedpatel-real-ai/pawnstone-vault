// Canonical application-level types for PawnTrack.
// These decouple the UI from any specific backend (Supabase, demo, etc.).

export interface Organization {
  id: string
  name: string
  created_at: string
}

export interface Customer {
  id: string
  org_id: string
  name: string
  email: string | null
  phone: string | null
  alt_phone: string | null
  address: string | null
  id_proof_number: string | null
  id_proof_url: string | null
  profile_photo_url: string | null
  notes: string | null
  created_at: string
}

export type LoanStatus = 'active' | 'overdue' | 'closed' | 'defaulted'
export type PaymentType = 'interest' | 'principal' | 'other'
export type DueStatus = 'pending' | 'paid' | 'overdue' | 'cancelled'

export interface Loan {
  id: string
  org_id: string
  customer_id: string
  asset_type: string | null
  asset_description: string | null
  asset_value: number | null
  loan_amount: number
  remaining_principal: number
  interest_rate_percent: number
  start_date: string
  due_date: string | null
  next_due_date: string
  term_months: number | null
  last_interest_calculated: string | null
  status: LoanStatus
  notes: string | null
  created_at: string
  updated_at: string | null
}

export interface Payment {
  id: string
  org_id: string
  loan_id: string
  amount: number
  payment_date: string
  type: PaymentType
  notes: string | null
  created_at: string
}

export interface Due {
  id: string
  org_id: string
  loan_id: string
  due_date: string
  amount: number
  due_type: string // 'interest' | 'principal'
  status: DueStatus
  created_at: string
}

export interface Notification {
  id: string
  org_id: string
  loan_id: string | null
  title: string
  body: string | null
  sent_at: string | null
  read: boolean
  created_at: string
}

export interface LoanAsset {
  id: string
  loan_id: string
  org_id: string
  file_url: string
  file_name: string
  file_size: number | null
  created_at: string
}

export interface AuditLog {
  id: string
  org_id: string
  user_id: string | null
  action: string | null
  meta: unknown
  created_at: string
}

// Session type for both demo and Supabase modes
export interface AppSession {
  user: {
    id: string
    email: string
  }
}
