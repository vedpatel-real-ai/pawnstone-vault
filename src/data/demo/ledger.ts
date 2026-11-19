import { businessDate } from '@/lib/businessDate'
import { addMonths, format, getDaysInMonth, parseISO, setDate } from 'date-fns'
import { calculateMonthlyInterest } from '@/lib/interest'
import type { Loan, Payment } from '../types'
import type { Ledger } from './demoStorage'

export function issueDue(ledger: Ledger, loan: Loan, date: string) {
  const amount = calculateMonthlyInterest(loan.remaining_principal, loan.interest_rate_percent)
  if (!amount || ledger.dues.some(d => d.loan_id === loan.id && d.due_date === date && d.due_type === 'interest')) return
  ledger.dues.push({ id: crypto.randomUUID(), loan_id: loan.id, org_id: loan.org_id, due_date: date,
    due_type: 'interest', amount, paid_amount: 0, status: 'pending', created_at: new Date().toISOString() })
}

export function assess(ledger: Ledger, loan: Loan, today: string) {
  if (loan.status !== 'active' && loan.status !== 'overdue') return
  while (loan.next_due_date <= today) {
    issueDue(ledger, loan, loan.next_due_date)
    const next = addMonths(parseISO(loan.next_due_date), 1)
    const day = Math.min(parseISO(loan.start_date).getDate(), getDaysInMonth(next))
    loan.next_due_date = format(setDate(next, day), 'yyyy-MM-dd')
    loan.last_interest_calculated = today
  }
  for (const d of ledger.dues) {
    if (d.loan_id === loan.id && d.status === 'pending' && d.due_date < today) d.status = 'overdue'
  }
}

export function postDemoPayment(ledger: Ledger, input: Omit<Payment,'id'|'created_at'> & {request_id:string}) {
  const cents = Math.round(input.amount * 100)
  if (!input.request_id || !Number.isSafeInteger(cents) || cents <= 0 || cents/100 !== input.amount ||
      !['interest','principal','other'].includes(input.type)) throw Error('Invalid receipt')
  const loan = ledger.loans.find(l => l.id === input.loan_id && l.org_id === input.org_id)
  if (!loan) throw Error('Loan unavailable')
  const existing = ledger.payments.find(p => p.org_id === input.org_id && p.request_id === input.request_id)
  if (existing) {
    if (existing.loan_id !== input.loan_id || existing.amount !== input.amount || existing.type !== input.type || existing.notes !== input.notes) {
      throw Error('Request already used for different terms')
    }
    return existing
  }
  if (!['active','overdue'].includes(loan.status)) throw Error('Loan is closed for collections')
  const today = businessDate()
  assess(ledger, loan, today)
  const open = ledger.dues.filter(d => d.loan_id === loan.id && ['pending','overdue'].includes(d.status))
  if (input.type === 'principal') {
    if (input.amount > loan.remaining_principal) throw Error('Payment exceeds principal')
    loan.remaining_principal = (Math.round(loan.remaining_principal*100)-cents)/100
  } else if (input.type === 'interest') {
    let left = cents
    for (const due of open.filter(d => d.due_type === 'interest').sort((a,b) => a.due_date.localeCompare(b.due_date))) {
      const billed = Math.round(due.amount * 100)
      const paid = Math.round((due.paid_amount ?? 0)*100)
      const take = Math.min(left,billed-paid)
      due.paid_amount = (paid+take)/100
      if (paid+take === billed) due.status = 'paid'
      left -= take
      if (!left) break
    }
    if (left) throw Error('Payment exceeds issued interest')
  }
  if (!loan.remaining_principal && open.every(d => d.status === 'paid')) loan.status = 'closed'
  const payment = { ...input, payment_date: today, id: crypto.randomUUID(), created_at: new Date().toISOString() }
  ledger.payments.push(payment)
  return payment
}
