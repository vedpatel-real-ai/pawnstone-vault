// Deterministic seed dataset for demo mode.
// Dates are computed dynamically relative to "now" at runtime so data is always fresh.

import { format, subDays, subMonths, addDays, addMonths } from 'date-fns'
import { calculateMonthlyInterest } from '@/lib/interest'
import type { Customer, Loan, Payment, Due, Notification, LoanAsset } from '../types'

const ORG_ID = 'demo-org-0001'

// Deterministic ID generators
const C = (n: number) => `demo-customer-${String(n).padStart(4, '0')}`
const L = (n: number) => `demo-loan-${String(n).padStart(4, '0')}`
const P = (n: number) => `demo-payment-${String(n).padStart(4, '0')}`
const D = (n: number) => `demo-due-${String(n).padStart(4, '0')}`
const N = (n: number) => `demo-notif-${String(n).padStart(4, '0')}`

function fmt(d: Date): string { return format(d, 'yyyy-MM-dd') }
function iso(d: Date): string { return d.toISOString() }

export function getDemoOrgId(): string { return ORG_ID }

export function createSeedData() {
  // Fresh reference date on every seed / reset invocation
  const now = new Date()

  // --- Customers ---
  const customers: Customer[] = [
    {
      id: C(1), org_id: ORG_ID, name: 'Rajesh Kumar', email: 'rajesh.kumar@example.com',
      phone: '9876543210', alt_phone: '9876543211', address: 'B-14 Sunrise Apartments, Andheri West, Mumbai',
      id_proof_number: 'ABCDE1234F', id_proof_url: null, profile_photo_url: null,
      notes: 'Tier 1 customer since 2023. Always prompt with gold pawn transactions.', created_at: iso(subDays(now, 180)),
    },
    {
      id: C(2), org_id: ORG_ID, name: 'Anita Sharma', email: 'anita.s@example.com',
      phone: '9123456780', alt_phone: null, address: '22 MG Road, Camp, Pune',
      id_proof_number: 'FGHIJ5678K', id_proof_url: null, profile_photo_url: null,
      notes: 'Automobile pawn. Follow-up required for delinquency reminder.', created_at: iso(subDays(now, 150)),
    },
    {
      id: C(3), org_id: ORG_ID, name: 'Vikram Patel', email: 'vikram.patel@example.com',
      phone: '9988776655', alt_phone: '9988776600', address: '45 Ring Road, Navrangpura, Ahmedabad',
      id_proof_number: 'LMNOP9012Q', id_proof_url: null, profile_photo_url: null,
      notes: 'Bullion trader. Pledges certified 24k gold bars and coins.', created_at: iso(subDays(now, 120)),
    },
    {
      id: C(4), org_id: ORG_ID, name: 'Deepa Nair', email: 'deepa.nair@example.com',
      phone: '8877665544', alt_phone: null, address: '7 Marine Drive, Ernakulam, Kochi',
      id_proof_number: 'RSTUV3456W', id_proof_url: null, profile_photo_url: null,
      notes: 'Commercial property title pledge. High-value borrower.', created_at: iso(subDays(now, 100)),
    },
    {
      id: C(5), org_id: ORG_ID, name: 'Arjun Mehta', email: 'arjun.mehta@example.com',
      phone: '7766554433', alt_phone: '7766554400', address: '101 Connaught Place, New Delhi',
      id_proof_number: 'XYZAB7890C', id_proof_url: null, profile_photo_url: null,
      notes: 'Jewellery business owner with repeat short-term bridge loans.', created_at: iso(subDays(now, 240)),
    },
    {
      id: C(6), org_id: ORG_ID, name: 'Sunita Reddy', email: 'sunita.reddy@example.com',
      phone: '6655443322', alt_phone: null, address: '33 Road No. 10, Banjara Hills, Hyderabad',
      id_proof_number: 'DEFGH2345I', id_proof_url: null, profile_photo_url: null,
      notes: 'Family gold heirloom pledge. Regular interest payments.', created_at: iso(subDays(now, 60)),
    },
    {
      id: C(7), org_id: ORG_ID, name: 'Mohammed Ali', email: 'mo.ali@example.com',
      phone: '5544332211', alt_phone: '5544332200', address: '8 Brigade Road, Central Bangalore',
      id_proof_number: 'JKLMN6789O', id_proof_url: null, profile_photo_url: null,
      notes: 'Luxury watch and asset borrower. Overdue reminder sent.', created_at: iso(subDays(now, 90)),
    },
    {
      id: C(8), org_id: ORG_ID, name: 'Priya Deshmukh', email: 'priya.d@example.com',
      phone: '9443322110', alt_phone: '9443322119', address: '12 FC Road, Deccan Gymkhana, Pune',
      id_proof_number: 'PQRST1234A', id_proof_url: null, profile_photo_url: null,
      notes: 'New borrower against agricultural title deed documents.', created_at: iso(subDays(now, 30)),
    },
  ]

  // --- Loans ---
  const loans: Loan[] = [
    // Loan 1: Rajesh — 22k Gold Chain & Bangles (Active, 4 months old, due upcoming in 2 days)
    {
      id: L(1), org_id: ORG_ID, customer_id: C(1),
      asset_type: 'gold', asset_description: '22k Hallmark Gold Chain (45g) & 2 Gold Bangles (30g)',
      asset_value: 425000, loan_amount: 250000, remaining_principal: 250000,
      interest_rate_percent: 2.0, start_date: fmt(subMonths(now, 4)),
      due_date: fmt(addMonths(subMonths(now, 4), 12)), next_due_date: fmt(addDays(now, 2)),
      term_months: 12, last_interest_calculated: null,
      status: 'active', notes: 'Gold appraised at 91.6% purity. Secure safe locker A-12.',
      created_at: iso(subMonths(now, 4)), updated_at: iso(subMonths(now, 4)),
    },

    // Loan 2: Anita — 2019 Maruti Swift (Overdue, 5 months old, missed last 2 interest dues)
    {
      id: L(2), org_id: ORG_ID, customer_id: C(2),
      asset_type: 'car', asset_description: '2019 Maruti Suzuki Swift VDi Diesel — Silver — MH12AB1234 with original RC book',
      asset_value: 480000, loan_amount: 300000, remaining_principal: 300000,
      interest_rate_percent: 2.5, start_date: fmt(subMonths(now, 5)),
      due_date: fmt(addMonths(subMonths(now, 5), 10)), next_due_date: fmt(subDays(now, 45)),
      term_months: 10, last_interest_calculated: null,
      status: 'overdue', notes: 'Vehicle parked in secure yard. 2 monthly dues unpaid. Legal notice pending.',
      created_at: iso(subMonths(now, 5)), updated_at: iso(subDays(now, 2)),
    },

    // Loan 3: Vikram — 24k Gold Coins (Active, 3 months old, upcoming due in 5 days)
    {
      id: L(3), org_id: ORG_ID, customer_id: C(3),
      asset_type: 'gold', asset_description: '24k (999 Purity) Certified Gold Coins (50g total) with assay certification',
      asset_value: 360000, loan_amount: 220000, remaining_principal: 220000,
      interest_rate_percent: 2.0, start_date: fmt(subMonths(now, 3)),
      due_date: fmt(addMonths(subMonths(now, 3), 12)), next_due_date: fmt(addDays(now, 5)),
      term_months: 12, last_interest_calculated: null,
      status: 'active', notes: 'Tamper-evident vault pouch #G-401.',
      created_at: iso(subMonths(now, 3)), updated_at: iso(subMonths(now, 3)),
    },

    // Loan 4: Deepa — Commercial Property Title (Active, 2 months old)
    {
      id: L(4), org_id: ORG_ID, customer_id: C(4),
      asset_type: 'property', asset_description: 'Registered Title Deed for Commercial Plot #45, Infopark Road, Kakkanad, Kochi',
      asset_value: 2800000, loan_amount: 800000, remaining_principal: 800000,
      interest_rate_percent: 1.5, start_date: fmt(subMonths(now, 2)),
      due_date: fmt(addMonths(subMonths(now, 2), 6)), next_due_date: fmt(addMonths(now, 1)),
      term_months: 6, last_interest_calculated: null,
      status: 'active', notes: 'Legal search clear. Original title deeds stored in fireproof vault.',
      created_at: iso(subMonths(now, 2)), updated_at: iso(subMonths(now, 2)),
    },

    // Loan 5: Arjun — Gold Jewellery Set (Closed, was 8 months old, fully repaid with interest)
    {
      id: L(5), org_id: ORG_ID, customer_id: C(5),
      asset_type: 'gold', asset_description: '22k Bridal Gold Necklace Set with Ruby stones (85g)',
      asset_value: 550000, loan_amount: 350000, remaining_principal: 0,
      interest_rate_percent: 2.0, start_date: fmt(subMonths(now, 8)),
      due_date: fmt(subMonths(now, 2)), next_due_date: fmt(subMonths(now, 2)),
      term_months: 6, last_interest_calculated: null,
      status: 'closed', notes: 'Loan fully settled. Gold returned to customer with receipt #CR-9042.',
      created_at: iso(subMonths(now, 8)), updated_at: iso(subMonths(now, 2)),
    },

    // Loan 6: Arjun — 2022 Honda City (Active, 1 month old)
    {
      id: L(6), org_id: ORG_ID, customer_id: C(5),
      asset_type: 'car', asset_description: '2022 Honda City ZX CVT Petrol — Platinum White — DL01XY5678',
      asset_value: 1100000, loan_amount: 450000, remaining_principal: 450000,
      interest_rate_percent: 2.2, start_date: fmt(subMonths(now, 1)),
      due_date: fmt(addMonths(subMonths(now, 1), 12)), next_due_date: fmt(addMonths(now, 0)),
      term_months: 12, last_interest_calculated: null,
      status: 'active', notes: 'Duplicate key & original insurance copy held.',
      created_at: iso(subMonths(now, 1)), updated_at: iso(subMonths(now, 1)),
    },

    // Loan 7: Sunita — 22k Gold Earrings & Pendant (Active, 3 weeks old)
    {
      id: L(7), org_id: ORG_ID, customer_id: C(6),
      asset_type: 'gold', asset_description: '22k Gold Jhumka Earrings and Floral Pendant (32g)',
      asset_value: 215000, loan_amount: 140000, remaining_principal: 140000,
      interest_rate_percent: 2.0, start_date: fmt(subDays(now, 21)),
      due_date: fmt(addMonths(subDays(now, 21), 6)), next_due_date: fmt(addDays(now, 9)),
      term_months: 6, last_interest_calculated: null,
      status: 'active', notes: 'Stored in Box #S-108.',
      created_at: iso(subDays(now, 21)), updated_at: iso(subDays(now, 21)),
    },

    // Loan 8: Mohammed Ali — Rolex Watch & Luxury Electronics (Overdue, 3 months old, missed 1 due 20 days ago)
    {
      id: L(8), org_id: ORG_ID, customer_id: C(7),
      asset_type: 'other', asset_description: 'Rolex Submariner Date (Ref 126610LN) with Box & Papers + MacBook Pro 16" M3 Max',
      asset_value: 1200000, loan_amount: 500000, remaining_principal: 500000,
      interest_rate_percent: 2.5, start_date: fmt(subMonths(now, 3)),
      due_date: fmt(addMonths(subMonths(now, 3), 6)), next_due_date: fmt(subDays(now, 20)),
      term_months: 6, last_interest_calculated: null,
      status: 'overdue', notes: 'Customer promised payment by weekend. Watch verified authentic.',
      created_at: iso(subMonths(now, 3)), updated_at: iso(subDays(now, 5)),
    },

    // Loan 9: Priya Deshmukh — Agricultural Land Title (Active, newly originated 10 days ago)
    {
      id: L(9), org_id: ORG_ID, customer_id: C(8),
      asset_type: 'property', asset_description: '7/12 Extract & Title Deeds for 2 Acres Agricultural Land in Baramati, Pune',
      asset_value: 1800000, loan_amount: 600000, remaining_principal: 600000,
      interest_rate_percent: 1.8, start_date: fmt(subDays(now, 10)),
      due_date: fmt(addMonths(subDays(now, 10), 12)), next_due_date: fmt(addDays(now, 20)),
      term_months: 12, last_interest_calculated: null,
      status: 'active', notes: 'First instalment due in 20 days.',
      created_at: iso(subDays(now, 10)), updated_at: iso(subDays(now, 10)),
    },
  ]

  // --- Payments: distributed across last 6 months for realistic charts ---
  let pIdx = 0
  const payments: Payment[] = []

  // Rajesh L(1): 250k @ 2% = 5000/mo. Paid months 1, 2, 3
  for (let m = 1; m <= 3; m++) {
    pIdx++
    payments.push({
      id: P(pIdx), org_id: ORG_ID, loan_id: L(1),
      amount: calculateMonthlyInterest(250000, 2.0),
      payment_date: fmt(subMonths(now, 4 - m)),
      type: 'interest', notes: `Month ${m} interest — Cash received`, created_at: iso(subMonths(now, 4 - m)),
    })
  }

  // Anita L(2): 300k @ 2.5% = 7500/mo. Paid months 1, 2, 3 (months 4 and 5 overdue)
  for (let m = 1; m <= 3; m++) {
    pIdx++
    payments.push({
      id: P(pIdx), org_id: ORG_ID, loan_id: L(2),
      amount: calculateMonthlyInterest(300000, 2.5),
      payment_date: fmt(subMonths(now, 5 - m)),
      type: 'interest', notes: `Month ${m} interest — UPI transfer`, created_at: iso(subMonths(now, 5 - m)),
    })
  }

  // Vikram L(3): 220k @ 2% = 4400/mo. Paid months 1, 2
  for (let m = 1; m <= 2; m++) {
    pIdx++
    payments.push({
      id: P(pIdx), org_id: ORG_ID, loan_id: L(3),
      amount: calculateMonthlyInterest(220000, 2.0),
      payment_date: fmt(subMonths(now, 3 - m)),
      type: 'interest', notes: `Month ${m} interest — Cheque cleared`, created_at: iso(subMonths(now, 3 - m)),
    })
  }

  // Deepa L(4): 800k @ 1.5% = 12000/mo. Paid month 1
  pIdx++
  payments.push({
    id: P(pIdx), org_id: ORG_ID, loan_id: L(4),
    amount: calculateMonthlyInterest(800000, 1.5),
    payment_date: fmt(subMonths(now, 1)),
    type: 'interest', notes: 'Month 1 interest — NEFT transfer', created_at: iso(subMonths(now, 1)),
  })

  // Arjun closed L(5): 350k @ 2% = 7000/mo for 6 months + 350k principal repayment
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
    type: 'principal', notes: 'Full loan principal payoff — Bank RTGS', created_at: iso(subMonths(now, 2)),
  })

  // Mohammed Ali L(8): 500k @ 2.5% = 12500/mo. Paid months 1 & 2 (month 3 overdue)
  for (let m = 1; m <= 2; m++) {
    pIdx++
    payments.push({
      id: P(pIdx), org_id: ORG_ID, loan_id: L(8),
      amount: calculateMonthlyInterest(500000, 2.5),
      payment_date: fmt(subMonths(now, 3 - m)),
      type: 'interest', notes: `Month ${m} interest`, created_at: iso(subMonths(now, 3 - m)),
    })
  }

  // Current month activity: Deepa partial interest payment
  pIdx++
  payments.push({
    id: P(pIdx), org_id: ORG_ID, loan_id: L(4),
    amount: calculateMonthlyInterest(800000, 1.5),
    payment_date: fmt(subDays(now, 3)),
    type: 'interest', notes: 'Current month advance interest', created_at: iso(subDays(now, 3)),
  })

  // --- Dues ---
  let dIdx = 0
  const dues: Due[] = []

  function addMonthlyDues(
    loanId: string,
    principal: number,
    rate: number,
    startDate: Date,
    totalDuesCount: number,
    paidDuesCount: number,
    customDates?: Date[]
  ) {
    for (let m = 1; m <= totalDuesCount; m++) {
      dIdx++
      const dueDate = customDates && customDates[m - 1] ? customDates[m - 1] : addMonths(startDate, m)
      let status: Due['status'] = 'pending'
      if (m <= paidDuesCount) {
        status = 'paid'
      } else if (dueDate < now) {
        status = 'overdue'
      }

      dues.push({
        id: D(dIdx), org_id: ORG_ID, loan_id: loanId,
        due_date: fmt(dueDate),
        amount: calculateMonthlyInterest(principal, rate),
        due_type: 'interest',
        status,
        created_at: iso(startDate),
      })
    }
  }

  // Loan 1 (Rajesh): 3 paid, 1 pending in 2 days (upcoming in 7-day window!)
  addMonthlyDues(L(1), 250000, 2.0, subMonths(now, 4), 4, 3, [
    subMonths(now, 3), subMonths(now, 2), subMonths(now, 1), addDays(now, 2)
  ])

  // Loan 2 (Anita): 3 paid, 2 overdue (45 days and 15 days overdue)
  addMonthlyDues(L(2), 300000, 2.5, subMonths(now, 5), 5, 3, [
    subMonths(now, 4), subMonths(now, 3), subMonths(now, 2), subDays(now, 45), subDays(now, 15)
  ])

  // Loan 3 (Vikram): 2 paid, 1 pending in 5 days (upcoming in 7-day window!)
  addMonthlyDues(L(3), 220000, 2.0, subMonths(now, 3), 3, 2, [
    subMonths(now, 2), subMonths(now, 1), addDays(now, 5)
  ])

  // Loan 4 (Deepa): 2 paid, 1 pending next month
  addMonthlyDues(L(4), 800000, 1.5, subMonths(now, 2), 3, 2, [
    subMonths(now, 1), subDays(now, 3), addMonths(now, 1)
  ])

  // Loan 5 (Arjun - closed): 6 paid dues
  addMonthlyDues(L(5), 350000, 2.0, subMonths(now, 8), 6, 6)

  // Loan 6 (Arjun - car): 1 pending in 12 days
  addMonthlyDues(L(6), 450000, 2.2, subMonths(now, 1), 1, 0, [addDays(now, 12)])

  // Loan 7 (Sunita): 1 pending in 9 days
  addMonthlyDues(L(7), 140000, 2.0, subDays(now, 21), 1, 0, [addDays(now, 9)])

  // Loan 8 (Mohammed Ali): 2 paid, 1 overdue (20 days overdue)
  addMonthlyDues(L(8), 500000, 2.5, subMonths(now, 3), 3, 2, [
    subMonths(now, 2), subMonths(now, 1), subDays(now, 20)
  ])

  // Loan 9 (Priya): 1 pending in 20 days
  addMonthlyDues(L(9), 600000, 1.8, subDays(now, 10), 1, 0, [addDays(now, 20)])

  // --- Notifications ---
  const notifications: Notification[] = [
    {
      id: N(1), org_id: ORG_ID, loan_id: L(2),
      title: 'Delinquency Alert: Anita Sharma',
      body: 'Anita Sharma has missed 2 monthly interest payments (₹15,000 overdue). Pledged asset: Maruti Swift.',
      sent_at: iso(subDays(now, 2)), read: false, created_at: iso(subDays(now, 2)),
    },
    {
      id: N(2), org_id: ORG_ID, loan_id: L(8),
      title: 'Payment Reminder: Mohammed Ali',
      body: 'Rolex & tech pawn interest of ₹12,500 is 20 days overdue.',
      sent_at: iso(subDays(now, 4)), read: false, created_at: iso(subDays(now, 4)),
    },
    {
      id: N(3), org_id: ORG_ID, loan_id: L(1),
      title: 'Upcoming Interest Due: Rajesh Kumar',
      body: 'Gold loan interest of ₹5,000 is due in 2 days.',
      sent_at: iso(subDays(now, 1)), read: false, created_at: iso(subDays(now, 1)),
    },
    {
      id: N(4), org_id: ORG_ID, loan_id: L(5),
      title: 'Loan Successfully Closed',
      body: 'Arjun Mehta has fully settled the gold bridal set loan (₹3,50,000 principal + ₹42,000 interest).',
      sent_at: iso(subMonths(now, 2)), read: true, created_at: iso(subMonths(now, 2)),
    },
    {
      id: N(5), org_id: ORG_ID, loan_id: null,
      title: 'PawnTrack Vault Ready',
      body: 'System initialized. Gold rates and operational dashboards active.',
      sent_at: iso(subDays(now, 180)), read: true, created_at: iso(subDays(now, 180)),
    },
  ]

  const loanAssets: LoanAsset[] = []

  return { customers, loans, payments, dues, notifications, loanAssets }
}
