import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { addMonths, eachMonthOfInterval, endOfMonth, format, parseISO, startOfMonth, subMonths } from 'date-fns'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { AlertTriangle, BadgeDollarSign, Banknote, Users, Boxes, TrendingUp } from 'lucide-react'
import { getProvider } from '@/data'

export default function Dashboard() {
  const { orgId } = useAuth()
  const navigate = useNavigate()
  const provider = getProvider()

  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const last12Start = startOfMonth(subMonths(now, 11))

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dashboard', orgId],
    queryFn: async () => {
      if (!orgId) return null
      const [loans, allDues, allPayments, customers] = await Promise.all([
        provider.loans.list(orgId),
        provider.dues.list(orgId),
        provider.payments.list(orgId),
        provider.customers.list(orgId),
      ])

      const duesOverdue = allDues.filter(d => d.status === 'overdue')
      const duesMonth = allDues.filter(d => d.due_type === 'interest' && (d.status === 'pending' || d.status === 'overdue') && d.due_date >= format(monthStart, 'yyyy-MM-dd') && d.due_date <= format(monthEnd, 'yyyy-MM-dd'))
      const duesWeek = allDues.filter(d => d.due_type === 'interest' && (d.status === 'pending' || d.status === 'overdue') && d.due_date >= format(now, 'yyyy-MM-dd') && d.due_date <= format(addMonths(now, 0), 'yyyy-MM-dd'))
      const paymentsInterest = allPayments.filter(p => p.type === 'interest' && p.payment_date >= format(last12Start, 'yyyy-MM-dd'))

      const customerMap = new Map(customers.map(c => [c.id, c.name]))

      const activeLoans = loans.filter(l => l.status === 'active')
      const assetsBreakdownRaw = activeLoans.reduce((acc: Record<string, number>, l) => {
        const t = (l.asset_type || 'other').toString().toLowerCase()
        const key = t.includes('gold') ? 'Gold' : t.includes('car') ? 'Cars' : 'Others'
        acc[key] = (acc[key] || 0) + 1
        return acc
      }, {})

      const overdueLoanSet = new Set<string>([
        ...loans.filter(l => l.status === 'overdue').map(l => l.id),
        ...duesOverdue.map(d => d.loan_id).filter(Boolean),
      ])

      const interestDueThisMonth = duesMonth.reduce((s, d) => s + Number(d.amount || 0), 0)
      const interestPaidThisMonth = paymentsInterest.filter(p => {
        const d = parseISO(p.payment_date)
        return d >= monthStart && d <= monthEnd
      }).reduce((s, p) => s + Number(p.amount || 0), 0)

      const monthlyTicks = eachMonthOfInterval({ start: last12Start, end: monthEnd })
      const monthlyInterestEarnings = monthlyTicks.map(m => {
        const key = format(m, 'yyyy-MM')
        const label = format(m, 'LLL')
        const total = paymentsInterest.filter(p => format(parseISO(p.payment_date), 'yyyy-MM') === key).reduce((s, p) => s + Number(p.amount || 0), 0)
        return { month: label, key, total }
      })

      const statusCounts = loans.reduce((acc: Record<string, number>, l) => {
        acc[l.status] = (acc[l.status] || 0) + 1
        return acc
      }, {})
      const loanStatusBreakdown = [
        { name: 'Active', value: statusCounts['active'] || 0 },
        { name: 'Closed', value: statusCounts['closed'] || 0 },
        { name: 'Overdue', value: statusCounts['overdue'] || 0 },
      ]

      const assetVsLoanTrend = monthlyTicks.map(m => {
        const key = format(m, 'yyyy-MM')
        const monthLoans = loans.filter(l => format(parseISO(l.start_date), 'yyyy-MM') === key)
        const asset = monthLoans.reduce((s, l) => s + Number(l.asset_value || 0), 0)
        const principal = monthLoans.reduce((s, l) => s + Number(l.loan_amount || 0), 0)
        return { month: format(m, 'LLL'), asset, principal }
      })

      const overdueLoansList = Array.from(overdueLoanSet).map(loanId => {
        const loan = loans.find(l => l.id === loanId)
        const dues = duesOverdue.filter(d => d.loan_id === loanId)
        const overdue_amount = dues.reduce((s, d) => s + Number(d.amount || 0), 0)
        const latestDue = dues.reduce((max: Date | null, d) => {
          const dd = parseISO(d.due_date)
          return !max || dd > max ? dd : max
        }, null as Date | null)
        const days_overdue = latestDue ? Math.ceil((now.getTime() - latestDue.getTime()) / (1000 * 60 * 60 * 24)) : 0
        return {
          loan_id: loanId,
          customer_name: loan?.customer_id ? customerMap.get(loan.customer_id) || 'Customer' : 'Customer',
          overdue_amount,
          days_overdue,
        }
      })

      const interestDueThisWeek = duesWeek.map(d => {
        const loan = loans.find(l => l.id === d.loan_id)
        return {
          due_id: d.id,
          loan_id: d.loan_id,
          customer_name: loan?.customer_id ? customerMap.get(loan.customer_id) || 'Customer' : 'Customer',
          amount: Number(d.amount || 0),
          due_date: d.due_date,
        }
      })

      const overdueInterestCustomerIds = new Set<string>()
      duesOverdue.forEach(d => {
        if (d.due_type === 'interest') {
          const loan = loans.find(l => l.id === d.loan_id)
          if (loan?.customer_id) overdueInterestCustomerIds.add(loan.customer_id)
        }
      })

      return {
        kpis: {
          totalActiveLoans: activeLoans.length,
          totalOverdueLoans: overdueLoanSet.size,
          interestDueThisMonth,
          interestPaidThisMonth,
          totalAssetsHeld: activeLoans.length,
          assetsBreakdown: assetsBreakdownRaw,
          customersWithOverdueInterest: overdueInterestCustomerIds.size,
        },
        charts: { monthlyInterestEarnings, loanStatusBreakdown, assetVsLoanTrend },
        alerts: { overdueLoansList, interestDueThisWeek },
        reference: { customers: customerMap, loans },
      }
    },
    enabled: !!orgId,
  })

  useEffect(() => {
    document.title = 'PawnTrack Dashboard – KPIs'
    const meta = document.querySelector("meta[name='description']") as HTMLMetaElement | null
    if (meta) meta.content = 'Live KPIs, charts, and alerts for your pawn business.'
  }, [])

  const [customerForm, setCustomerForm] = useState({ name: '', email: '', phone: '', address: '' })
  const [loanForm, setLoanForm] = useState({ customer_id: '', loan_amount: '', interest_rate_percent: '2.5', start_date: format(new Date(), 'yyyy-MM-dd'), asset_type: 'gold', asset_description: '', asset_value: '' })
  const [paymentForm, setPaymentForm] = useState({ loan_id: '', amount: '' })

  const addCustomer = async () => {
    if (!orgId || !customerForm.name.trim()) return
    await provider.customers.create({ ...customerForm, org_id: orgId, alt_phone: null, id_proof_number: null, id_proof_url: null, profile_photo_url: null, notes: null } as any)
    setCustomerForm({ name: '', email: '', phone: '', address: '' })
    await refetch()
  }

  const addLoan = async () => {
    if (!orgId || !loanForm.customer_id || !Number(loanForm.loan_amount)) return
    const nextDue = format(addMonths(parseISO(loanForm.start_date), 1), 'yyyy-MM-dd')
    await provider.loans.create({
      org_id: orgId,
      customer_id: loanForm.customer_id,
      loan_amount: Number(loanForm.loan_amount),
      remaining_principal: Number(loanForm.loan_amount),
      interest_rate_percent: Number(loanForm.interest_rate_percent),
      start_date: loanForm.start_date,
      next_due_date: nextDue,
      due_date: format(addMonths(parseISO(loanForm.start_date), 12), 'yyyy-MM-dd'),
      status: 'active',
      asset_type: loanForm.asset_type,
      asset_description: loanForm.asset_description,
      asset_value: Number(loanForm.asset_value || 0),
      term_months: 12,
      last_interest_calculated: null,
      notes: null,
    })
    setLoanForm({ customer_id: '', loan_amount: '', interest_rate_percent: '2.5', start_date: format(new Date(), 'yyyy-MM-dd'), asset_type: 'gold', asset_description: '', asset_value: '' })
    await refetch()
  }

  const addPayment = async () => {
    if (!orgId || !paymentForm.loan_id || !Number(paymentForm.amount)) return
    await provider.payments.create({ org_id: orgId, loan_id: paymentForm.loan_id, amount: Number(paymentForm.amount), type: 'interest', payment_date: format(new Date(), 'yyyy-MM-dd'), notes: null })
    setPaymentForm({ loan_id: '', amount: '' })
    await refetch()
  }

  const sendReminder = async (loanId: string) => {
    if (!orgId) return
    await provider.notifications.create({ org_id: orgId, loan_id: loanId, title: 'Payment reminder', body: 'Your payment is due. Please pay at the earliest.', sent_at: new Date().toISOString(), read: false })
  }

  const markDuePaid = async (dueId: string, loanId: string, amount: number) => {
    if (!orgId) return
    await provider.payments.create({ org_id: orgId, loan_id: loanId, amount, type: 'interest', payment_date: format(new Date(), 'yyyy-MM-dd'), notes: 'Due marked as paid' })
    await provider.dues.update(dueId, { status: 'paid' })
    await refetch()
  }

  const k = data?.kpis
  const monthly = data?.charts.monthlyInterestEarnings || []
  const statusPie = data?.charts.loanStatusBreakdown || []
  const trend = data?.charts.assetVsLoanTrend || []

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Dashboard</h1>

      {/* Quick Actions Toolbar */}
      <div className="flex flex-wrap gap-2">
        <Dialog>
          <DialogTrigger asChild><Button variant="secondary">Add Customer</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Customer</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Name" value={customerForm.name} onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })} />
              <Input placeholder="Email" value={customerForm.email} onChange={e => setCustomerForm({ ...customerForm, email: e.target.value })} />
              <Input placeholder="Phone" value={customerForm.phone} onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })} />
              <Input placeholder="Address" value={customerForm.address} onChange={e => setCustomerForm({ ...customerForm, address: e.target.value })} />
            </div>
            <DialogFooter><Button onClick={addCustomer}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog>
          <DialogTrigger asChild><Button variant="secondary">Add Loan</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Loan</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Select value={loanForm.customer_id} onValueChange={(v) => setLoanForm({ ...loanForm, customer_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {Array.from(data?.reference.customers?.entries() || []).map(([id, name]) => (
                    <SelectItem key={id} value={id}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Loan amount" type="number" value={loanForm.loan_amount} onChange={e => setLoanForm({ ...loanForm, loan_amount: e.target.value })} />
              <Input placeholder="Interest rate % per month" type="number" step="0.001" value={loanForm.interest_rate_percent} onChange={e => setLoanForm({ ...loanForm, interest_rate_percent: e.target.value })} />
              <Input placeholder="Start date" type="date" value={loanForm.start_date} onChange={e => setLoanForm({ ...loanForm, start_date: e.target.value })} />
              <Select value={loanForm.asset_type} onValueChange={(v) => setLoanForm({ ...loanForm, asset_type: v })}>
                <SelectTrigger><SelectValue placeholder="Asset type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gold">Gold</SelectItem>
                  <SelectItem value="car">Cars</SelectItem>
                  <SelectItem value="other">Others</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Asset description" value={loanForm.asset_description} onChange={e => setLoanForm({ ...loanForm, asset_description: e.target.value })} />
              <Input placeholder="Asset value" type="number" value={loanForm.asset_value} onChange={e => setLoanForm({ ...loanForm, asset_value: e.target.value })} />
            </div>
            <DialogFooter><Button onClick={addLoan}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog>
          <DialogTrigger asChild><Button variant="secondary">Record Interest Payment</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Interest Payment</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Select value={paymentForm.loan_id} onValueChange={(v) => setPaymentForm({ ...paymentForm, loan_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select loan" /></SelectTrigger>
                <SelectContent>
                  {(data?.reference.loans || []).map((l: any) => (
                    <SelectItem key={l.id} value={l.id}>{l.asset_type || 'Asset'} — ₹{l.loan_amount}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Amount" type="number" value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
            </div>
            <DialogFooter><Button onClick={addPayment}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog>
          <DialogTrigger asChild><Button variant="secondary">Send Payment Reminder</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Send Reminder</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {(data?.alerts.overdueLoansList || []).map((o: any) => (
                <div key={o.loan_id} className="flex items-center justify-between border rounded-md p-3">
                  <div>{o.customer_name} · Loan #{o.loan_id.slice(0,6)} · ₹{o.overdue_amount}</div>
                  <Button size="sm" onClick={() => sendReminder(o.loan_id)}>Send</Button>
                </div>
              ))}
              {(data?.alerts.overdueLoansList || []).length === 0 && (
                <div className="text-sm text-muted-foreground">No overdue loans.</div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {[{
          label: 'Total Active Loans', value: k?.totalActiveLoans ?? '-', icon: <BadgeDollarSign className="h-5 w-5" />, onClick: () => navigate('/loans?status=active')
        },{
          label: 'Total Overdue Loans', value: k?.totalOverdueLoans ?? '-', icon: <AlertTriangle className="h-5 w-5" />, onClick: () => navigate('/loans?status=overdue')
        },{
          label: 'Interest Due This Month', value: k ? `₹${k.interestDueThisMonth}` : '-', icon: <Banknote className="h-5 w-5" />, onClick: () => navigate(`/payments?dueMonth=${format(now, 'yyyy-MM')}`)
        },{
          label: 'Interest Paid This Month', value: k ? `₹${k.interestPaidThisMonth}` : '-', icon: <TrendingUp className="h-5 w-5" />, onClick: () => navigate(`/payments?month=${format(now, 'yyyy-MM')}`)
        },{
          label: 'Total Assets Held', value: k?.totalAssetsHeld ?? '-', icon: <Boxes className="h-5 w-5" />, onClick: () => navigate('/assets')
        },{
          label: 'Customers with Overdue Interest', value: k?.customersWithOverdueInterest ?? '-', icon: <Users className="h-5 w-5" />, onClick: () => navigate('/customers?overdue=true')
        }].map((item, idx) => (
          <Card key={idx} className="hover-scale cursor-pointer" onClick={item.onClick}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
              {item.icon}
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-20" /> : <div className={`text-2xl font-semibold ${idx===1 && (k?.totalOverdueLoans||0)>0 ? 'text-destructive' : ''}`}>{item.value}</div>}
              {idx===4 && !isLoading && (
                <div className="mt-2 text-xs text-muted-foreground">Gold: {k?.assetsBreakdown?.Gold || 0} · Cars: {k?.assetsBreakdown?.Cars || 0} · Others: {k?.assetsBreakdown?.Others || 0}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="flex items-center justify-between"><CardTitle>Monthly Interest Earnings</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-40 w-full" /> : (
              <ChartContainer config={{}} className="h-64">
                <BarChart data={monthly} onClick={(e: any) => { if (e && e.activeLabel) { const idx = monthly.findIndex((m: any) => m.month === e.activeLabel); if (idx>=0) navigate(`/payments?month=${monthly[idx].key}`) } }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Loan Status Breakdown</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-40 w-full" /> : (
              <ChartContainer config={{}} className="h-64">
                <PieChart>
                  <Pie data={statusPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} onClick={(data: any) => { if (data?.name) navigate(`/loans?status=${data.name.toLowerCase()}`) }} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Asset Value vs Loan Amount</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-40 w-full" /> : (
              <ChartContainer config={{}} className="h-64">
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line yAxisId="left" type="monotone" dataKey="asset" stroke="hsl(var(--primary))" />
                  <Line yAxisId="right" type="monotone" dataKey="principal" stroke="hsl(var(--muted-foreground))" />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Overdue Loans</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-24 w-full" /> : (
              <div className="space-y-2">
                {(data?.alerts.overdueLoansList || []).map((o: any) => (
                  <div key={o.loan_id} className="flex items-center justify-between border rounded-md p-3">
                    <div className="flex-1">
                      <div className="font-medium">{o.customer_name} · Loan #{o.loan_id.slice(0,6)}</div>
                      <div className="text-sm text-muted-foreground">Overdue: ₹{o.overdue_amount} · {o.days_overdue} days</div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/loans?loan=${o.loan_id}`)}>Open</Button>
                      <Button size="sm" onClick={() => sendReminder(o.loan_id)}>Remind</Button>
                    </div>
                  </div>
                ))}
                {(data?.alerts.overdueLoansList || []).length === 0 && (
                  <div className="text-sm text-muted-foreground">No overdue loans 🎉</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Interest Due This Week</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-24 w-full" /> : (
              <div className="space-y-2">
                {(data?.alerts.interestDueThisWeek || []).map((a: any) => (
                  <div key={a.due_id} className="flex items-center justify-between border rounded-md p-3">
                    <div className="flex-1">
                      <div className="font-medium">{a.customer_name} · Loan #{String(a.loan_id).slice(0,6)}</div>
                      <div className="text-sm text-muted-foreground">Due {a.due_date} · ₹{a.amount}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/loans?loan=${a.loan_id}`)}>Open</Button>
                      <Button size="sm" onClick={() => markDuePaid(a.due_id, a.loan_id, a.amount)}>Mark paid</Button>
                    </div>
                  </div>
                ))}
                {(data?.alerts.interestDueThisWeek || []).length === 0 && (
                  <div className="text-sm text-muted-foreground">No interest due this week.</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
