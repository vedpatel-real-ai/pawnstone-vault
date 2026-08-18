import { addDays, eachMonthOfInterval, endOfMonth, format, isBefore, parseISO, startOfDay, startOfMonth, subMonths } from 'date-fns'
import type { Due, Loan, Payment, Customer } from '@/data/types'

export interface UpcomingDueItem {
  due_id: string
  loan_id: string
  customer_id: string
  customer_name: string
  amount: number
  due_date: string
  days_until_due: number
}

export interface OverdueLoanItem {
  loan_id: string
  customer_id: string
  customer_name: string
  asset_type: string
  loan_amount: number
  overdue_amount: number
  oldest_due_date: string
  days_overdue: number
  unpaid_dues_count: number
}

export interface MonthlyEarningsItem {
  month: string // e.g. "Mar"
  key: string   // e.g. "2026-03"
  total: number
}

export interface StatusBreakdownItem {
  name: string
  key: string
  value: number
  color: string
}

export interface OriginationComparisonItem {
  month: string // e.g. "Mar"
  key: string
  loanAmount: number
  collateralValue: number
}

export interface AssetMixItem {
  name: string
  key: string
  count: number
  totalValue: number
  percentage: number
}

/**
 * Format currency in Indian numbering system (e.g. ₹1,50,000)
 */
export function formatINR(amount: number): string {
  const rounded = Math.round(amount)
  return `₹${rounded.toLocaleString('en-IN')}`
}

/**
 * Calculate upcoming interest dues in the 7-day window: [today, today + 7 days].
 * Properly handles month and year boundaries.
 */
export function calculateUpcoming7DayDues(
  dues: Due[],
  loans: Loan[],
  customers: Customer[],
  referenceDate: Date = new Date()
): UpcomingDueItem[] {
  const today = startOfDay(referenceDate)
  const endWindow = startOfDay(addDays(today, 7))
  const todayStr = format(today, 'yyyy-MM-dd')
  const endWindowStr = format(endWindow, 'yyyy-MM-dd')

  const loanMap = new Map(loans.map(l => [l.id, l]))
  const customerMap = new Map(customers.map(c => [c.id, c.name]))

  return dues
    .filter(d => {
      if (d.due_type !== 'interest') return false
      if (d.status !== 'pending' && d.status !== 'overdue') return false
      return d.due_date >= todayStr && d.due_date <= endWindowStr
    })
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .map(d => {
      const loan = loanMap.get(d.loan_id)
      const customerName = loan ? customerMap.get(loan.customer_id) || 'Customer' : 'Customer'
      const dueDate = startOfDay(parseISO(d.due_date))
      const diffTime = dueDate.getTime() - today.getTime()
      const daysUntil = Math.round(diffTime / (1000 * 60 * 60 * 24))

      return {
        due_id: d.id,
        loan_id: d.loan_id,
        customer_id: loan?.customer_id || '',
        customer_name: customerName,
        amount: Number(d.amount || 0),
        due_date: d.due_date,
        days_until_due: daysUntil,
      }
    })
}

/**
 * Calculate overdue loans list with accurate delinquency days based on the OLDEST unpaid due date.
 */
export function calculateOverdueLoans(
  loans: Loan[],
  dues: Due[],
  customers: Customer[],
  referenceDate: Date = new Date()
): OverdueLoanItem[] {
  const today = startOfDay(referenceDate)
  const todayStr = format(today, 'yyyy-MM-dd')
  const customerMap = new Map(customers.map(c => [c.id, c.name]))

  // Identify all overdue dues
  const overdueDues = dues.filter(d => {
    if (d.status === 'overdue') return true
    if (d.status === 'pending' && d.due_date < todayStr) return true
    return false
  })

  // Group overdue dues by loan_id
  const duesByLoan = new Map<string, Due[]>()
  for (const d of overdueDues) {
    const list = duesByLoan.get(d.loan_id) || []
    list.push(d)
    duesByLoan.set(d.loan_id, list)
  }

  // A loan is considered overdue if loan.status === 'overdue' OR it has overdue dues
  const overdueLoans = loans.filter(l => {
    if (l.status === 'closed') return false
    if (l.status === 'overdue') return true
    const list = duesByLoan.get(l.id)
    return Boolean(list && list.length > 0)
  })

  return overdueLoans.map(l => {
    const list = duesByLoan.get(l.id) || []
    const overdueAmount = list.reduce((sum, d) => sum + Number(d.amount || 0), 0)

    // Find earliest (oldest) missed due date to accurately represent delinquency age
    let oldestDate: Date | null = null
    for (const d of list) {
      const parsed = startOfDay(parseISO(d.due_date))
      if (!oldestDate || isBefore(parsed, oldestDate)) {
        oldestDate = parsed
      }
    }

    // Fallback if no specific due is found but loan itself is overdue
    if (!oldestDate && l.due_date) {
      const loanDue = startOfDay(parseISO(l.due_date))
      if (isBefore(loanDue, today)) {
        oldestDate = loanDue
      }
    }
    if (!oldestDate) {
      oldestDate = today
    }

    const diffDays = Math.max(0, Math.ceil((today.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24)))

    return {
      loan_id: l.id,
      customer_id: l.customer_id,
      customer_name: customerMap.get(l.customer_id) || 'Customer',
      asset_type: l.asset_type || 'Other',
      loan_amount: Number(l.loan_amount || 0),
      overdue_amount: overdueAmount > 0 ? overdueAmount : Number(l.remaining_principal || 0),
      oldest_due_date: format(oldestDate, 'yyyy-MM-dd'),
      days_overdue: diffDays,
      unpaid_dues_count: list.length,
    }
  }).sort((a, b) => b.days_overdue - a.days_overdue)
}

/**
 * Calculate collateral / assets currently held by the business.
 * Pledged assets are held for active AND overdue loans (and defaulted loans if collateral is still held).
 * Closed loans (where collateral was returned) are strictly excluded.
 */
export function calculateHeldAssets(loans: Loan[]): {
  totalCount: number
  totalValue: number
  breakdown: Record<string, { count: number; value: number }>
} {
  const heldLoans = loans.filter(l => l.status === 'active' || l.status === 'overdue' || l.status === 'defaulted')

  const breakdown: Record<string, { count: number; value: number }> = {
    Gold: { count: 0, value: 0 },
    Vehicles: { count: 0, value: 0 },
    Property: { count: 0, value: 0 },
    Other: { count: 0, value: 0 },
  }

  let totalValue = 0

  for (const loan of heldLoans) {
    const rawType = (loan.asset_type || 'other').toLowerCase()
    const val = Number(loan.asset_value || 0)
    totalValue += val

    let cat = 'Other'
    if (rawType.includes('gold') || rawType.includes('jewel')) cat = 'Gold'
    else if (rawType.includes('car') || rawType.includes('vehicle') || rawType.includes('bike') || rawType.includes('auto')) cat = 'Vehicles'
    else if (rawType.includes('property') || rawType.includes('land') || rawType.includes('house') || rawType.includes('deed')) cat = 'Property'

    breakdown[cat].count += 1
    breakdown[cat].value += val
  }

  return {
    totalCount: heldLoans.length,
    totalValue,
    breakdown,
  }
}

/**
 * Calculate chronological monthly interest earnings trend.
 * Defaults to last 6 months for a clean, dense operational view.
 */
export function calculateMonthlyInterestTrend(
  payments: Payment[],
  monthsCount: number = 6,
  referenceDate: Date = new Date()
): MonthlyEarningsItem[] {
  const now = referenceDate
  const startDate = startOfMonth(subMonths(now, monthsCount - 1))
  const endDate = endOfMonth(now)
  const intervals = eachMonthOfInterval({ start: startDate, end: endDate })

  const startStr = format(startDate, 'yyyy-MM-dd')
  const interestPayments = payments.filter(p => p.type === 'interest' && p.payment_date >= startStr)

  return intervals.map(m => {
    const key = format(m, 'yyyy-MM')
    const label = format(m, 'MMM')
    const total = interestPayments
      .filter(p => p.payment_date.startsWith(key))
      .reduce((sum, p) => sum + Number(p.amount || 0), 0)

    return {
      month: label,
      key,
      total,
    }
  })
}

/**
 * Calculate loan status breakdown for Donut chart with distinct colors.
 */
export function calculateLoanStatusBreakdown(loans: Loan[]): StatusBreakdownItem[] {
  const counts: Record<string, number> = {
    active: 0,
    overdue: 0,
    closed: 0,
    defaulted: 0,
  }

  for (const l of loans) {
    if (l.status in counts) {
      counts[l.status] += 1
    } else {
      counts.active += 1
    }
  }

  const items: StatusBreakdownItem[] = [
    { name: 'Active', key: 'active', value: counts.active, color: '#10b981' }, // Emerald / Green
    { name: 'Overdue', key: 'overdue', value: counts.overdue, color: '#f43f5e' }, // Rose / Red
    { name: 'Closed', key: 'closed', value: counts.closed, color: '#94a3b8' }, // Slate / Muted
  ]

  if (counts.defaulted > 0) {
    items.push({ name: 'Defaulted', key: 'defaulted', value: counts.defaulted, color: '#f59e0b' }) // Amber
  }

  return items
}

/**
 * Calculate monthly new loan origination vs pledged collateral comparison on a single shared scale.
 */
export function calculateOriginationComparison(
  loans: Loan[],
  monthsCount: number = 6,
  referenceDate: Date = new Date()
): OriginationComparisonItem[] {
  const now = referenceDate
  const startDate = startOfMonth(subMonths(now, monthsCount - 1))
  const endDate = endOfMonth(now)
  const intervals = eachMonthOfInterval({ start: startDate, end: endDate })

  return intervals.map(m => {
    const key = format(m, 'yyyy-MM')
    const monthLoans = loans.filter(l => l.start_date && l.start_date.startsWith(key))

    const loanAmount = monthLoans.reduce((sum, l) => sum + Number(l.loan_amount || 0), 0)
    const collateralValue = monthLoans.reduce((sum, l) => sum + Number(l.asset_value || 0), 0)

    return {
      month: format(m, 'MMM'),
      key,
      loanAmount,
      collateralValue,
    }
  })
}

/**
 * Calculate asset mix breakdown for currently held collateral.
 */
export function calculateAssetMix(loans: Loan[]): AssetMixItem[] {
  const { totalValue, breakdown } = calculateHeldAssets(loans)

  const categories = [
    { name: 'Gold & Jewellery', key: 'Gold' },
    { name: 'Vehicles', key: 'Vehicles' },
    { name: 'Property Documents', key: 'Property' },
    { name: 'Other Collateral', key: 'Other' },
  ]

  return categories.map(cat => {
    const data = breakdown[cat.key] || { count: 0, value: 0 }
    const percentage = totalValue > 0 ? Math.round((data.value / totalValue) * 100) : 0

    return {
      name: cat.name,
      key: cat.key,
      count: data.count,
      totalValue: data.value,
      percentage,
    }
  }).filter(item => item.count > 0)
}
