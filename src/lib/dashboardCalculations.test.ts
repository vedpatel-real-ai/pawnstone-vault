import { describe, it, expect } from 'vitest'
import {
  calculateUpcoming7DayDues,
  calculateOverdueLoans,
  calculateHeldAssets,
  calculateMonthlyInterestTrend,
  calculateLoanStatusBreakdown,
  calculateOriginationComparison,
  calculateAssetMix,
  formatINR,
} from './dashboardCalculations'
import type { Customer, Due, Loan, Payment } from '@/data/types'

describe('dashboardCalculations', () => {
  const refDate = new Date('2026-08-18T10:00:00Z')

  const dummyCustomers: Customer[] = [
    { id: 'c1', org_id: 'org1', name: 'Rajesh Kumar', email: null, phone: '9876543210', alt_phone: null, address: null, id_proof_number: null, id_proof_url: null, profile_photo_url: null, notes: null, created_at: '2026-01-01T00:00:00Z' },
    { id: 'c2', org_id: 'org1', name: 'Anita Sharma', email: null, phone: '9123456780', alt_phone: null, address: null, id_proof_number: null, id_proof_url: null, profile_photo_url: null, notes: null, created_at: '2026-01-01T00:00:00Z' },
  ]

  const dummyLoans: Loan[] = [
    {
      id: 'l1', org_id: 'org1', customer_id: 'c1',
      asset_type: 'gold', asset_description: 'Gold chain', asset_value: 300000,
      loan_amount: 200000, remaining_principal: 200000, interest_rate_percent: 2.0,
      start_date: '2026-07-01', due_date: '2027-07-01', next_due_date: '2026-08-20',
      term_months: 12, last_interest_calculated: null, status: 'active', notes: null,
      created_at: '2026-07-01T00:00:00Z', updated_at: null,
    },
    {
      id: 'l2', org_id: 'org1', customer_id: 'c2',
      asset_type: 'car', asset_description: 'Honda City', asset_value: 600000,
      loan_amount: 300000, remaining_principal: 300000, interest_rate_percent: 2.5,
      start_date: '2026-05-01', due_date: '2026-08-01', next_due_date: '2026-06-01',
      term_months: 6, last_interest_calculated: null, status: 'overdue', notes: null,
      created_at: '2026-05-01T00:00:00Z', updated_at: null,
    },
    {
      id: 'l3', org_id: 'org1', customer_id: 'c1',
      asset_type: 'property', asset_description: 'Land deed', asset_value: 1000000,
      loan_amount: 500000, remaining_principal: 0, interest_rate_percent: 1.5,
      start_date: '2026-01-01', due_date: '2026-07-01', next_due_date: '2026-07-01',
      term_months: 6, last_interest_calculated: null, status: 'closed', notes: null,
      created_at: '2026-01-01T00:00:00Z', updated_at: null,
    },
  ]

  it('formatINR formats numbers with Indian grouping and rupee symbol', () => {
    expect(formatINR(18000)).toBe('₹18,000')
    expect(formatINR(250000)).toBe('₹2,50,000')
    expect(formatINR(0)).toBe('₹0')
  })

  it('calculateUpcoming7DayDues matches dues from today through today + 7 days', () => {
    const dues: Due[] = [
      // Past due - should NOT match
      { id: 'd1', org_id: 'org1', loan_id: 'l1', due_date: '2026-08-10', amount: 4000, due_type: 'interest', status: 'overdue', created_at: '2026-07-01' },
      // Today (2026-08-18) - SHOULD match
      { id: 'd2', org_id: 'org1', loan_id: 'l1', due_date: '2026-08-18', amount: 4000, due_type: 'interest', status: 'pending', created_at: '2026-07-01' },
      // In 2 days (2026-08-20) - SHOULD match
      { id: 'd3', org_id: 'org1', loan_id: 'l1', due_date: '2026-08-20', amount: 4000, due_type: 'interest', status: 'pending', created_at: '2026-07-01' },
      // In 7 days (2026-08-25) - SHOULD match
      { id: 'd4', org_id: 'org1', loan_id: 'l1', due_date: '2026-08-25', amount: 4000, due_type: 'interest', status: 'pending', created_at: '2026-07-01' },
      // In 8 days (2026-08-26) - should NOT match
      { id: 'd5', org_id: 'org1', loan_id: 'l1', due_date: '2026-08-26', amount: 4000, due_type: 'interest', status: 'pending', created_at: '2026-07-01' },
      // Paid due in window - should NOT match
      { id: 'd6', org_id: 'org1', loan_id: 'l1', due_date: '2026-08-22', amount: 4000, due_type: 'interest', status: 'paid', created_at: '2026-07-01' },
    ]

    const upcoming = calculateUpcoming7DayDues(dues, dummyLoans, dummyCustomers, refDate)
    expect(upcoming).toHaveLength(3)
    expect(upcoming.map(u => u.due_id)).toEqual(['d2', 'd3', 'd4'])
    expect(upcoming[0].days_until_due).toBe(0)
    expect(upcoming[1].days_until_due).toBe(2)
    expect(upcoming[2].days_until_due).toBe(7)
  })

  it('calculateOverdueLoans uses OLDEST unpaid due date to compute days overdue', () => {
    const dues: Due[] = [
      // Anita missed due on June 1 (78 days ago) and July 1 (48 days ago)
      { id: 'd10', org_id: 'org1', loan_id: 'l2', due_date: '2026-06-01', amount: 7500, due_type: 'interest', status: 'overdue', created_at: '2026-05-01' },
      { id: 'd11', org_id: 'org1', loan_id: 'l2', due_date: '2026-07-01', amount: 7500, due_type: 'interest', status: 'overdue', created_at: '2026-05-01' },
    ]

    const overdueList = calculateOverdueLoans(dummyLoans, dues, dummyCustomers, refDate)
    expect(overdueList).toHaveLength(1)
    expect(overdueList[0].loan_id).toBe('l2')
    expect(overdueList[0].customer_name).toBe('Anita Sharma')
    expect(overdueList[0].overdue_amount).toBe(15000)
    expect(overdueList[0].oldest_due_date).toBe('2026-06-01')
    expect(overdueList[0].days_overdue).toBe(78)
  })

  it('calculateHeldAssets includes active and overdue loans but excludes closed', () => {
    const held = calculateHeldAssets(dummyLoans)
    // l1 is active (gold 300k), l2 is overdue (car 600k), l3 is closed (property - excluded)
    expect(held.totalCount).toBe(2)
    expect(held.totalValue).toBe(900000)
    expect(held.breakdown.Gold.count).toBe(1)
    expect(held.breakdown.Gold.value).toBe(300000)
    expect(held.breakdown.Vehicles.count).toBe(1)
    expect(held.breakdown.Vehicles.value).toBe(600000)
    expect(held.breakdown.Property.count).toBe(0)
  })

  it('calculateLoanStatusBreakdown counts active, overdue, closed, defaulted correctly', () => {
    const breakdown = calculateLoanStatusBreakdown(dummyLoans)
    const active = breakdown.find(b => b.key === 'active')
    const overdue = breakdown.find(b => b.key === 'overdue')
    const closed = breakdown.find(b => b.key === 'closed')

    expect(active?.value).toBe(1)
    expect(overdue?.value).toBe(1)
    expect(closed?.value).toBe(1)
  })

  it('calculateMonthlyInterestTrend aggregates earnings chronologically', () => {
    const payments: Payment[] = [
      { id: 'p1', org_id: 'org1', loan_id: 'l1', amount: 5000, type: 'interest', payment_date: '2026-07-15', notes: null, created_at: '2026-07-15' },
      { id: 'p2', org_id: 'org1', loan_id: 'l1', amount: 5000, type: 'interest', payment_date: '2026-08-10', notes: null, created_at: '2026-08-10' },
      { id: 'p3', org_id: 'org1', loan_id: 'l1', amount: 50000, type: 'principal', payment_date: '2026-08-10', notes: null, created_at: '2026-08-10' },
    ]

    const trend = calculateMonthlyInterestTrend(payments, 6, refDate)
    expect(trend).toHaveLength(6)
    const jul = trend.find(t => t.key === '2026-07')
    const aug = trend.find(t => t.key === '2026-08')

    expect(jul?.total).toBe(5000)
    expect(aug?.total).toBe(5000) // principal excluded from interest earnings
  })
})
