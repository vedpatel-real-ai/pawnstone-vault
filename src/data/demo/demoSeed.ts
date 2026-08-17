// Deterministic seed dataset for demo mode.
// Dates are relative to "now" so dashboards always look populated.

import { format, subDays, subMonths, addMonths } from 'date-fns'
import { calculateMonthlyInterest } from '@/lib/interest'
import type { Customer, Loan, Payment, Due, Notification, LoanAsset } from '../types'

const ORG_ID = 'demo-org-0001'
const now = new Date()

// Deterministic IDs
const C = (n: number) => `demo-customer-${String(n).padStart(4, '0')}`
const L = (n: number) => `demo-loan-${String(n).padStart(4, '0')}`
const P = (n: number) => `demo-payment-${String(n).padStart(4, '0')}`
const D = (n: number) => `demo-due-${String(n).padStart(4, '0')}`
const N = (n: number) => `demo-notif-${String(n).padStart(4, '0')}`

function fmt(d: Date) { return format(d, 'yyyy-MM-dd') }
function iso(d: Date) { return d.toISOString() }

export function getDemoOrgId(): string { return ORG_ID }

export function createSeedData() {
  const customers: Customer[] = [
    { id: C(1), org_id: ORG_ID, name: 'Rajesh Kumar', email: 'rajesh@example.com', phone: '9876543210', alt_phone: '9876543211', address: 'B-14 Sunrise Apartments, Mumbai', id_proof_number: 'ABCDE1234F', id_proof_url: null, profile_photo_url: null, notes: 'Regular customer since 2023', created_at: iso(subDays(now, 180)) },
    { id: C(2), org_id: ORG_ID, name: 'Anita Sharma', email: 'anita.s@example.com', phone: '9123456780', alt_phone: null, address: '22 MG Road, Pune', id_proof_number: 'FGHIJ5678K', id_proof_url: null, profile_photo_url: null, notes: null, created_at: iso(subDays(now, 150)) },
    { id: C(3), org_id: ORG_ID, name: 'Vikram Patel', email: 'vikram.p@example.com', phone: '9988776655', alt_phone: '9988776600', address: '45 Ring Road, Ahmedabad', id_proof_number: 'LMNOP9012Q', id_proof_url: null, profile_photo_url: null, notes: 'Referred by Rajesh Kumar', created_at: iso(subDays(now, 120)) },
    { id: C(4), org_id: ORG_ID, name: 'Deepa Nair', email: 'deepa.n@example.com', phone: '8877665544', alt_phone: null, address: '7 Marine Drive, Kochi', id_proof_number: 'RSTUV3456W', id_proof_url: null, profile_photo_url: null, notes: null, created_at: iso(subDays(now, 100)) },
    { id: C(5), org_id: ORG_ID, name: 'Arjun Mehta', email: 'arjun.m@example.com', phone: '7766554433', alt_phone: '7766554400', address: '101 Connaught Place, Delhi', id_proof_number: 'XYZAB7890C', id_proof_url: null, profile_photo_url: null, notes: 'Business owner — jewellery shop', created_at: iso(subDays(now, 90)) },
    { id: C(6), org_id: ORG_ID, name: 'Sunita Reddy', email: 'sunita.r@example.com', phone: '6655443322', alt_phone: null, address: '33 Banjara Hills, Hyderabad', id_proof_number: 'DEFGH2345I', id_proof_url: null, profile_photo_url: null, notes: 'First-time borrower', created_at: iso(subDays(now, 60)) },
    { id: C(7), org_id: ORG_ID, name: 'Mohammed Ali', email: 'mo.ali@example.com', phone: '5544332211', alt_phone: '5544332200', address: '8 Brigade Road, Bangalore', id_proof_number: 'JKLMN6789O', id_proof_url: null, profile_photo_url: null, notes: null, created_at: iso(subDays(now, 45)) },
  ]

  // --- Loans ---
  const loans: Loan[] = [
    // Loan 1: Rajesh — gold, active, 4 months old
    {
      id: L(1), org_id: ORG_ID, customer_id: C(1),
      asset_type: 'gold', asset_description: '22k gold chain (45g) and gold bangles (30g)',
      asset_value: 375000, loan_amount: 250000, remaining_principal: 250000,
      interest_rate_percent: 2.0, start_date: fmt(subMonths(now, 4)),
      due_date: fmt(addMonths(subMonths(now, 4), 12)), next_due_date: fmt(addMonths(now, 0)),
      term_months: 12, last_interest_calculated: null,
      status: 'active', notes: 'Gold pledged at current market rate', created_at: iso(subMonths(now, 4)), updated_at: iso(subMonths(now, 4)),
    },
    // Loan 2: Anita — car, overdue (due date passed), 5 months old
    {
      id: L(2), org_id: ORG_ID, customer_id: C(2),
      asset_type: 'car', asset_description: '2019 Maruti Swift VDi — Silver — MH12AB1234',
      asset_value: 480000, loan_amount: 300000, remaining_principal: 300000,
      interest_rate_percent: 3.0, start_date: fmt(subMonths(now, 5)),
      due_date: fmt(subDays(now, 15)), next_due_date: fmt(subDays(now, 15)),
      term_months: 10, last_interest_calculated: null,
      status: 'overdue', notes: 'Customer missed last payment', created_at: iso(subMonths(now, 5)), updated_at: iso(subDays(now, 1)),
    },
    // Loan 3: Vikram — gold, active, 3 months old
    {
      id: L(3), org_id: ORG_ID, customer_id: C(3),
      asset_type: 'gold', asset_description: '24k gold coins (50g total)',
      asset_value: 310000, loan_amount: 200000, remaining_principal: 200000,
      interest_rate_percent: 2.5, start_date: fmt(subMonths(now, 3)),
      due_date: fmt(addMonths(subMonths(now, 3), 12)), next_due_date: fmt(addMonths(now, 0)),
      term_months: 12, last_interest_calculated: null,
      status: 'active', notes: null, created_at: iso(subMonths(now, 3)), updated_at: iso(subMonths(now, 3)),
    },
    // Loan 4: Deepa — property documents, active, 2 months old
    {
      id: L(4), org_id: ORG_ID, customer_id: C(4),
      asset_type: 'other', asset_description: 'Property title deed — Plot No 45, Kochi',
      asset_value: 2000000, loan_amount: 500000, remaining_principal: 500000,
      interest_rate_percent: 1.5, start_date: fmt(subMonths(now, 2)),
      due_date: fmt(addMonths(subMonths(now, 2), 6)), next_due_date: fmt(addMonths(now, 0)),
      term_months: 6, last_interest_calculated: null,
      status: 'active', notes: 'Short-term loan against property', created_at: iso(subMonths(now, 2)), updated_at: iso(subMonths(now, 2)),
    },
    // Loan 5: Arjun — gold, closed, was 6 months old
    {
      id: L(5), org_id: ORG_ID, customer_id: C(5),
      asset_type: 'gold', asset_description: 'Mixed gold jewellery set (80g)',
      asset_value: 500000, loan_amount: 350000, remaining_principal: 0,
      interest_rate_percent: 2.0, start_date: fmt(subMonths(now, 8)),
      due_date: fmt(subMonths(now, 2)), next_due_date: fmt(subMonths(now, 2)),
      term_months: 6, last_interest_calculated: null,
      status: 'closed', notes: 'Fully repaid', created_at: iso(subMonths(now, 8)), updated_at: iso(subMonths(now, 2)),
    },
    // Loan 6: Arjun — car, active, 1 month old
    {
      id: L(6), org_id: ORG_ID, customer_id: C(5),
      asset_type: 'car', asset_description: '2021 Honda City ZX CVT — White — DL01XY5678',
      asset_value: 900000, loan_amount: 400000, remaining_principal: 400000,
      interest_rate_percent: 2.5, start_date: fmt(subMonths(now, 1)),
      due_date: fmt(addMonths(subMonths(now, 1), 12)), next_due_date: fmt(addMonths(now, 0)),
      term_months: 12, last_interest_calculated: null,
      status: 'active', notes: null, created_at: iso(subMonths(now, 1)), updated_at: iso(subMonths(now, 1)),
    },
    // Loan 7: Sunita — gold, active, 3 weeks old
    {
      id: L(7), org_id: ORG_ID, customer_id: C(6),
      asset_type: 'gold', asset_description: '22k gold earrings and pendant set (25g)',
      asset_value: 162000, loan_amount: 100000, remaining_principal: 100000,
      interest_rate_percent: 2.0, start_date: fmt(subDays(now, 21)),
      due_date: fmt(addMonths(subDays(now, 21), 6)), next_due_date: fmt(addMonths(subDays(now, 21), 1)),
      term_months: 6, last_interest_calculated: null,
      status: 'active', notes: null, created_at: iso(subDays(now, 21)), updated_at: iso(subDays(now, 21)),
    },
  ]

  // --- Payments: spread across months for chart data ---
  let pIdx = 0
  const payments: Payment[] = []

  // Rajesh loan 1: paid interest for months 1-3
  for (let m = 1; m <= 3; m++) {
    pIdx++
    payments.push({
      id: P(pIdx), org_id: ORG_ID, loan_id: L(1),
      amount: calculateMonthlyInterest(250000, 2.0),
      payment_date: fmt(subMonths(now, 4 - m)),
      type: 'interest', notes: `Month ${m} interest`, created_at: iso(subMonths(now, 4 - m)),
    })
  }

  // Anita loan 2: paid interest for months 1-3 only (overdue for months 4-5)
  for (let m = 1; m <= 3; m++) {
    pIdx++
    payments.push({
      id: P(pIdx), org_id: ORG_ID, loan_id: L(2),
      amount: calculateMonthlyInterest(300000, 3.0),
      payment_date: fmt(subMonths(now, 5 - m)),
      type: 'interest', notes: `Month ${m} interest`, created_at: iso(subMonths(now, 5 - m)),
    })
  }

  // Vikram loan 3: paid months 1-2
  for (let m = 1; m <= 2; m++) {
    pIdx++
    payments.push({
      id: P(pIdx), org_id: ORG_ID, loan_id: L(3),
      amount: calculateMonthlyInterest(200000, 2.5),
      payment_date: fmt(subMonths(now, 3 - m)),
      type: 'interest', notes: `Month ${m} interest`, created_at: iso(subMonths(now, 3 - m)),
    })
  }

  // Deepa loan 4: paid month 1
  pIdx++
  payments.push({
    id: P(pIdx), org_id: ORG_ID, loan_id: L(4),
    amount: calculateMonthlyInterest(500000, 1.5),
    payment_date: fmt(subMonths(now, 1)),
    type: 'interest', notes: 'Month 1 interest', created_at: iso(subMonths(now, 1)),
  })

  // Arjun closed loan 5: paid 6 months of interest + principal
  for (let m = 1; m <= 6; m++) {
    pIdx++
    payments.push({
      id: P(pIdx), org_id: ORG_ID, loan_id: L(5),
      amount: calculateMonthlyInterest(350000, 2.0),
      payment_date: fmt(subMonths(now, 8 - m)),
      type: 'interest', notes: `Month ${m} interest`, created_at: iso(subMonths(now, 8 - m)),
    })
  }
  pIdx++
  payments.push({
    id: P(pIdx), org_id: ORG_ID, loan_id: L(5),
    amount: 350000, payment_date: fmt(subMonths(now, 2)),
    type: 'principal', notes: 'Full principal repayment', created_at: iso(subMonths(now, 2)),
  })

  // --- Dues ---
  let dIdx = 0
  const dues: Due[] = []

  // Helper: generate monthly interest dues for a loan
  function addDues(loanId: string, principal: number, rate: number, startDate: Date, months: number, paidMonths: number) {
    for (let m = 1; m <= months; m++) {
      dIdx++
      const dueDate = addMonths(startDate, m)
      let status: Due['status'] = 'pending'
      if (m <= paidMonths) status = 'paid'
      else if (dueDate < now) status = 'overdue'
      dues.push({
        id: D(dIdx), org_id: ORG_ID, loan_id: loanId,
        due_date: fmt(dueDate), amount: calculateMonthlyInterest(principal, rate),
        due_type: 'interest', status, created_at: iso(startDate),
      })
    }
  }

  addDues(L(1), 250000, 2.0, subMonths(now, 4), 4, 3) // month 4 pending/due now
  addDues(L(2), 300000, 3.0, subMonths(now, 5), 5, 3) // months 4-5 overdue
  addDues(L(3), 200000, 2.5, subMonths(now, 3), 3, 2) // month 3 pending
  addDues(L(4), 500000, 1.5, subMonths(now, 2), 2, 1) // month 2 pending
  addDues(L(5), 350000, 2.0, subMonths(now, 8), 6, 6) // all paid (closed loan)
  addDues(L(6), 400000, 2.5, subMonths(now, 1), 1, 0) // month 1 pending
  addDues(L(7), 100000, 2.0, subDays(now, 21), 0, 0) // no dues yet (too new)

  // --- Notifications ---
  const notifications: Notification[] = [
    { id: N(1), org_id: ORG_ID, loan_id: L(2), title: 'Overdue payment reminder', body: 'Anita Sharma has missed 2 interest payments on the car loan.', sent_at: iso(subDays(now, 3)), read: false, created_at: iso(subDays(now, 3)) },
    { id: N(2), org_id: ORG_ID, loan_id: L(1), title: 'Interest due this month', body: 'Rajesh Kumar\'s gold loan interest of ₹5,000 is due.', sent_at: iso(subDays(now, 1)), read: false, created_at: iso(subDays(now, 1)) },
    { id: N(3), org_id: ORG_ID, loan_id: L(5), title: 'Loan closed', body: 'Arjun Mehta has fully repaid the gold jewellery loan.', sent_at: iso(subMonths(now, 2)), read: true, created_at: iso(subMonths(now, 2)) },
    { id: N(4), org_id: ORG_ID, loan_id: null, title: 'Welcome to PawnTrack', body: 'Your pawnshop management system is ready.', sent_at: iso(subDays(now, 180)), read: true, created_at: iso(subDays(now, 180)) },
  ]

  // No pre-seeded loan assets (they require actual files)
  const loanAssets: LoanAsset[] = []

  return { customers, loans, payments, dues, notifications, loanAssets }
}
