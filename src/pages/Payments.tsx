import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/useAuth'
import { useLocation, useNavigate } from 'react-router-dom'
import { endOfMonth, format, parseISO, startOfMonth } from 'date-fns'
import { getProvider } from '@/data'
import { formatINR } from '@/lib/dashboardCalculations'
import { ExportButtons } from '@/components/ExportButtons'
import { DollarSign, Calendar, CreditCard, ArrowUpRight } from 'lucide-react'

export default function Payments() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { orgId } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const provider = getProvider()
  const params = new URLSearchParams(location.search)
  const monthParam = params.get('month')
  const dueMonthParam = params.get('dueMonth')

  const { data: loans = [] } = useQuery({
    queryKey: ['loans', orgId],
    queryFn: async () => orgId ? provider.loans.list(orgId) : [],
    enabled: !!orgId,
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', orgId],
    queryFn: async () => orgId ? provider.customers.list(orgId) : [],
    enabled: !!orgId,
  })

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments', orgId],
    queryFn: async () => orgId ? provider.payments.list(orgId) : [],
    enabled: !!orgId,
  })

  const { data: duesForMonth = [] } = useQuery({
    queryKey: ['dues-month', orgId, dueMonthParam],
    queryFn: async () => {
      if (!orgId || !dueMonthParam) return []
      const start = `${dueMonthParam}-01`
      const end = format(endOfMonth(parseISO(start)), 'yyyy-MM-dd')
      const allDues = await provider.dues.list(orgId)
      return allDues.filter(d =>
        d.due_type === 'interest' &&
        (d.status === 'pending' || d.status === 'overdue') &&
        d.due_date >= start && d.due_date <= end
      ).sort((a, b) => a.due_date.localeCompare(b.due_date))
    },
    enabled: !!orgId && !!dueMonthParam,
  })

  const customerMap = useMemo(() => new Map(customers.map(c => [c.id, c.name])), [customers])
  const loanMap = useMemo(() => new Map(loans.map(l => [l.id, l])), [loans])

  // Active / payable loans for new payments
  const payableLoans = useMemo(() => loans.filter(l => l.status === 'active' || l.status === 'overdue'), [loans])

  const [form, setForm] = useState({ loan_id: '', amount: '', type: 'interest', notes: '' })
  const canSave = useMemo(() => form.loan_id && Number(form.amount) > 0, [form])

  useEffect(() => {
    document.title = 'Payments & Dues | PawnTrack'
  }, [])

  const addPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId || !form.loan_id || Number(form.amount) <= 0) return

    try {
      await provider.payments.create({
        loan_id: form.loan_id,
        amount: Number(form.amount),
        type: form.type as 'interest' | 'principal' | 'other',
        org_id: orgId,
        payment_date: format(new Date(), 'yyyy-MM-dd'),
        notes: form.notes || `${form.type === 'interest' ? 'Interest' : 'Principal'} payment`,
      })

      toast({
        title: 'Payment recorded',
        description: `Successfully logged ${formatINR(Number(form.amount))} (${form.type}).`,
      })
      setForm({ loan_id: '', amount: '', type: 'interest', notes: '' })
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['loans-detailed'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record payment'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    }
  }

  const visiblePayments = useMemo(() => {
    if (!monthParam) return payments
    const start = parseISO(`${monthParam}-01`)
    const end = endOfMonth(start)
    return payments.filter(p => {
      const d = parseISO(p.payment_date)
      return d >= start && d <= end
    })
  }, [payments, monthParam])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payments & Collections</h1>
          <p className="text-sm text-muted-foreground">Log interest dues and principal repayments with automatic ledger balancing.</p>
        </div>
        <ExportButtons data={visiblePayments || []} filename="payments-ledger" />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Record New Payment Card */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Record Collection</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addPayment} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Loan *</label>
                <select
                  value={form.loan_id}
                  onChange={(e) => {
                    const lId = e.target.value
                    const match = loanMap.get(lId)
                    setForm({
                      ...form,
                      loan_id: lId,
                      amount: match ? String((match.remaining_principal * match.interest_rate_percent) / 100) : form.amount,
                    })
                  }}
                  className="w-full border rounded-md h-10 px-3 bg-background text-sm"
                  required
                >
                  <option value="">Choose borrower & loan...</option>
                  {payableLoans.map((l) => (
                    <option key={l.id} value={l.id}>
                      {customerMap.get(l.customer_id) || 'Borrower'} — {l.asset_type} (₹{l.remaining_principal.toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Payment Type *</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full border rounded-md h-10 px-3 bg-background text-sm"
                >
                  <option value="interest">Monthly Interest Collection</option>
                  <option value="principal">Principal Repayment</option>
                  <option value="other">Other Fees / Charges</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Amount (₹) *</label>
                <Input
                  placeholder="Payment amount"
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Notes / Reference</label>
                <Input
                  placeholder="e.g. UPI Ref #4902194 or Cash Receipt"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <Button type="submit" className="w-full" disabled={!canSave}>
                Record Payment
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Payment History & Scheduled Dues */}
        <div className="md:col-span-2 space-y-6">
          {dueMonthParam && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Interest Dues for {dueMonthParam}</CardTitle>
                <Button size="sm" variant="ghost" onClick={() => navigate('/payments')}>
                  Show All Payments
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {duesForMonth.map((d) => {
                    const loan = loanMap.get(d.loan_id)
                    const customerName = loan ? customerMap.get(loan.customer_id) : 'Customer'
                    return (
                      <div
                        key={d.id}
                        className={`flex items-center justify-between p-3 border rounded-lg ${
                          d.status === 'overdue' ? 'border-destructive/40 bg-destructive/5' : 'bg-muted/20'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-sm">
                            {customerName} · Due: {d.due_date}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            Loan #{d.loan_id.slice(0, 8)}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-sm">{formatINR(d.amount)}</span>
                          <Badge variant={d.status === 'overdue' ? 'destructive' : 'outline'}>
                            {d.status}
                          </Badge>
                        </div>
                      </div>
                    )
                  })}
                  {duesForMonth.length === 0 && (
                    <div className="text-sm text-muted-foreground py-4 text-center">
                      No pending or overdue interest dues for this month.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                Payment Ledger
                {monthParam && (
                  <Badge variant="secondary" className="ml-2 font-normal">
                    Filter: {monthParam}
                  </Badge>
                )}
              </CardTitle>
              {monthParam && (
                <Button size="sm" variant="ghost" onClick={() => navigate('/payments')}>
                  Clear Filter
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {visiblePayments.map((p) => {
                  const loan = loanMap.get(p.loan_id)
                  const borrowerName = loan ? customerMap.get(loan.customer_id) : 'Borrower'

                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3.5 border rounded-lg hover:bg-accent/40 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{borrowerName}</span>
                          <Badge
                            variant={p.type === 'interest' ? 'default' : p.type === 'principal' ? 'secondary' : 'outline'}
                            className="capitalize text-xs"
                          >
                            {p.type}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span>{p.payment_date}</span>
                          {p.notes && <span>· {p.notes}</span>}
                          <span className="font-mono">· #{p.loan_id.slice(0, 8)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-base text-emerald-600">{formatINR(p.amount)}</div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs px-1 text-muted-foreground hover:text-foreground"
                          onClick={() => navigate(`/loans?loan=${p.loan_id}`)}
                        >
                          View Loan <ArrowUpRight className="w-3 h-3 ml-0.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
                {!paymentsLoading && visiblePayments.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    No payments found.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
