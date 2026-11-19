import { businessDate } from '@/lib/businessDate'
import { usePaymentPosting } from '@/hooks/usePaymentPosting'
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { addMonths, endOfMonth, format, parseISO, startOfMonth, subMonths } from 'date-fns'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlertTriangle,
  Banknote,
  Boxes,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  DollarSign,
  Plus,
  Send,
  ShieldCheck,
  TrendingUp,
  User,
  Users,
} from 'lucide-react'
import { getProvider } from '@/data'
import {
  calculateAssetMix,
  calculateHeldAssets,
  calculateLoanStatusBreakdown,
  calculateMonthlyInterestTrend,
  calculateOriginationComparison,
  calculateOverdueLoans,
  calculateUpcoming7DayDues,
  formatINR,
} from '@/lib/dashboardCalculations'

export default function Dashboard() {
  const { orgId, isDemo } = useAuth()
  const navigate = useNavigate()
  const provider = getProvider()
  const { toast } = useToast()
  const qc = useQueryClient()
  const { post, posting } = usePaymentPosting()

  const now = new Date()
  const currentMonthStr = format(now, 'yyyy-MM')
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const startMonthStr = format(monthStart, 'yyyy-MM-dd')
  const endMonthStr = format(monthEnd, 'yyyy-MM-dd')

  const [trendMonths, setTrendMonths] = useState<6 | 12>(6)

  // Quick Action Modal States
  const [openCustomerModal, setOpenCustomerModal] = useState(false)
  const [openLoanModal, setOpenLoanModal] = useState(false)
  const [openPaymentModal, setOpenPaymentModal] = useState(false)
  const [openReminderModal, setOpenReminderModal] = useState(false)

  // Forms
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', address: '', notes: '' })
  const [loanForm, setLoanForm] = useState({
    customer_id: '',
    loan_amount: '',
    interest_rate_percent: '2.0',
    start_date: businessDate(),
    due_date: format(addMonths(now, 12), 'yyyy-MM-dd'),
    asset_type: 'gold',
    asset_description: '',
    asset_value: '',
  })
  const [paymentForm, setPaymentForm] = useState({
    loan_id: '',
    amount: '',
    type: 'interest' as 'interest' | 'principal',
    notes: '',
  })

  // Sent reminders tracking (debounce per session)
  const [sentReminders, setSentReminders] = useState<Set<string>>(new Set())

  // Core Data Query
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', orgId, trendMonths],
    queryFn: async () => {
      if (!orgId) return null

      // Trigger automatic due generation in demo mode to keep dues fresh
      if (provider.generateDues) {
        await provider.generateDues(orgId)
      }

      const [loans, allDues, allPayments, customers] = await Promise.all([
        provider.loans.list(orgId),
        provider.dues.list(orgId),
        provider.payments.list(orgId),
        provider.customers.list(orgId),
      ])

      const customerMap = new Map(customers.map(c => [c.id, c.name]))

      // 1. KPI: Active Loans
      const activeLoans = loans.filter(l => l.status === 'active')

      // 2. KPI: Overdue Loans
      const overdueLoansList = calculateOverdueLoans(loans, allDues, customers, now)

      // 3. KPI: Interest Due This Month
      const duesMonth = allDues.filter(
        d =>
          d.due_type === 'interest' &&
          (d.status === 'pending' || d.status === 'overdue') &&
          d.due_date >= startMonthStr &&
          d.due_date <= endMonthStr
      )
      const interestDueThisMonth = duesMonth.reduce((sum, d) => sum + (d.amount - (d.paid_amount ?? 0)), 0)

      // 4. KPI: Interest Paid This Month
      const paymentsThisMonth = allPayments.filter(
        p =>
          p.type === 'interest' &&
          p.payment_date >= startMonthStr &&
          p.payment_date <= endMonthStr
      )
      const interestPaidThisMonth = paymentsThisMonth.reduce((sum, p) => sum + Number(p.amount || 0), 0)

      // 5. KPI: Held Collateral (Active + Overdue)
      const heldAssets = calculateHeldAssets(loans)

      // 6. KPI: Customers with Overdue Interest
      const overdueCustomerIds = new Set<string>()
      allDues
        .filter(d => d.status === 'overdue' && d.due_type === 'interest')
        .forEach(d => {
          const l = loans.find(x => x.id === d.loan_id)
          if (l?.customer_id) overdueCustomerIds.add(l.customer_id)
        })

      // 7. Upcoming 7-Day Dues
      const upcomingDues = calculateUpcoming7DayDues(allDues, loans, customers, now)

      // 8. Charts
      const monthlyInterestEarnings = calculateMonthlyInterestTrend(allPayments, trendMonths, now)
      const loanStatusBreakdown = calculateLoanStatusBreakdown(loans)
      const originationTrend = calculateOriginationComparison(loans, 6, now)
      const assetMix = calculateAssetMix(loans)

      return {
        kpis: {
          totalActiveLoans: activeLoans.length,
          totalOverdueLoans: overdueLoansList.length,
          interestDueThisMonth,
          interestPaidThisMonth,
          totalAssetsHeldCount: heldAssets.totalCount,
          totalAssetsHeldValue: heldAssets.totalValue,
          assetsBreakdown: heldAssets.breakdown,
          customersWithOverdueInterest: overdueCustomerIds.size,
        },
        charts: {
          monthlyInterestEarnings,
          loanStatusBreakdown,
          originationTrend,
          assetMix,
        },
        alerts: {
          overdueLoansList,
          upcomingDues,
        },
        reference: {
          customers,
          customerMap,
          loans,
          payableLoans: loans.filter(l => l.status === 'active' || l.status === 'overdue'),
        },
      }
    },
    enabled: !!orgId,
  })

  useEffect(() => {
    document.title = 'Vault Command Dashboard | PawnTrack'
    const meta = document.querySelector("meta[name='description']") as HTMLMetaElement | null
    if (meta) meta.content = 'Query-based operational dashboard for pawn loan portfolio management.'
  }, [])

  // Quick Action Handlers
  const handleAddCustomer = async () => {
    if (!orgId || !customerForm.name.trim() || !customerForm.phone.trim()) {
      toast({ title: 'Validation Error', description: 'Name and 10-digit phone number are required.', variant: 'destructive' })
      return
    }
    try {
      await provider.customers.create({
        org_id: orgId,
        name: customerForm.name.trim(),
        phone: customerForm.phone.trim(),
        address: customerForm.address.trim() || null,
        notes: customerForm.notes.trim() || null,
        email: null,
        alt_phone: null,
        id_proof_number: null,
        id_proof_url: null,
        profile_photo_url: null,
      })
      toast({ title: 'Customer added', description: `${customerForm.name} saved to directory.` })
      setCustomerForm({ name: '', phone: '', address: '', notes: '' })
      setOpenCustomerModal(false)
      await refetch()
      qc.invalidateQueries({ queryKey: ['customers'] })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add customer'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    }
  }

  const handleAddLoan = async () => {
    if (!orgId || !loanForm.customer_id || !Number(loanForm.loan_amount) || !loanForm.asset_description.trim()) {
      toast({ title: 'Validation Error', description: 'Please select a borrower and fill in principal and asset description.', variant: 'destructive' })
      return
    }
    try {
      const loan = await provider.loans.create({
        org_id: orgId,
        customer_id: loanForm.customer_id,
        loan_amount: Number(loanForm.loan_amount),
        remaining_principal: Number(loanForm.loan_amount),
        interest_rate_percent: Number(loanForm.interest_rate_percent),
        start_date: loanForm.start_date,
        due_date: loanForm.due_date,
        next_due_date: format(addMonths(parseISO(loanForm.start_date), 1), 'yyyy-MM-dd'),
        term_months: 12,
        status: 'active',
        asset_type: loanForm.asset_type,
        asset_description: loanForm.asset_description,
        asset_value: Number(loanForm.asset_value || 0),
        last_interest_calculated: null,
        notes: null,
      })

      toast({ title: 'Loan originated', description: `Loan #${loan.id.slice(0, 8)} created successfully.` })
      setLoanForm({
        customer_id: '',
        loan_amount: '',
        interest_rate_percent: '2.0',
        start_date: businessDate(),
        due_date: format(addMonths(now, 12), 'yyyy-MM-dd'),
        asset_type: 'gold',
        asset_description: '',
        asset_value: '',
      })
      setOpenLoanModal(false)
      await refetch()
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['loans-detailed'] })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create loan'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    }
  }

  const handleAddPayment = async () => {
    if (!orgId || !paymentForm.loan_id || !Number(paymentForm.amount)) {
      toast({ title: 'Validation Error', description: 'Please choose a loan and valid payment amount.', variant: 'destructive' })
      return
    }
    try {
      await post({
        org_id: orgId,
        loan_id: paymentForm.loan_id,
        amount: Number(paymentForm.amount),
        type: paymentForm.type,
        payment_date: format(now, 'yyyy-MM-dd'),
        notes: paymentForm.notes || `${paymentForm.type === 'interest' ? 'Interest collection' : 'Principal paydown'}`,
      })
      toast({ title: 'Payment recorded', description: `${formatINR(Number(paymentForm.amount))} logged successfully.` })
      setPaymentForm({ loan_id: '', amount: '', type: 'interest', notes: '' })
      setOpenPaymentModal(false)
      await refetch()
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['loans-detailed'] })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record payment'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    }
  }

  const handleSendReminder = async (loanId: string, customerName: string) => {
    if (!orgId) return
    try {
      await provider.notifications.create({
        org_id: orgId,
        loan_id: loanId,
        title: `Payment Reminder: ${customerName}`,
        body: `Internal reminder recorded for delinquent loan #${loanId.slice(0, 8)}.`,
        sent_at: new Date().toISOString(),
        read: false,
      })
      setSentReminders(prev => new Set(prev).add(loanId))
      toast({
        title: 'Reminder recorded',
        description: `Delinquency alert recorded for ${customerName}.`,
      })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send reminder'
      toast({ title: 'Failed to send reminder', description: msg, variant: 'destructive' })
    }
  }

  const k = data?.kpis
  const monthlyData = data?.charts.monthlyInterestEarnings || []
  const statusPie = data?.charts.loanStatusBreakdown || []
  const totalStatusCount = statusPie.reduce((s, i) => s + i.value, 0)
  const originationData = data?.charts.originationTrend || []
  const assetMixData = data?.charts.assetMix || []

  if (isError) return <p role="alert">Could not load portfolio data. <button onClick={() => refetch()}>Retry</button></p>
  return (
    <div className="space-y-6">
      {/* Header & Quick Action Bar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Vault Operations Dashboard</h1>
            {isDemo && (
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold">
                Live Demo Environment
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Portfolio metrics, collateral audit, scheduled interest dues, and delinquency watch.
          </p>
        </div>

        {/* Quick Actions Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setOpenCustomerModal(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Add Customer
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOpenLoanModal(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Originate Loan
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOpenPaymentModal(true)}>
            <DollarSign className="w-4 h-4 mr-1.5" /> Record Payment
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setOpenReminderModal(true)}>
            <Send className="w-3.5 h-3.5 mr-1.5" /> Send Reminder
          </Button>
        </div>
      </div>

      {/* Primary KPI Cards (6 Key Operational Metrics) */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* KPI 1: Active Loans */}
        <Card
          className="hover:border-primary/50 transition-all cursor-pointer group shadow-sm"
          role="link" tabIndex={0}
          onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.click() }}
          onClick={() => navigate('/loans?status=active')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Active Loans</CardTitle>
            <ShieldCheck className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div>
                <div className="text-2xl font-bold">{k?.totalActiveLoans ?? 0}</div>
                <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                  <span>In good standing</span>
                  <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* KPI 2: Overdue Loans */}
        <Card
          className={`hover:border-destructive/60 transition-all cursor-pointer group shadow-sm ${
            (k?.totalOverdueLoans || 0) > 0 ? 'border-destructive/30 bg-destructive/5' : ''
          }`}
          role="link" tabIndex={0}
          onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.click() }}
          onClick={() => navigate('/loans?status=overdue')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Overdue Loans</CardTitle>
            <AlertTriangle
              className={`w-4 h-4 ${
                (k?.totalOverdueLoans || 0) > 0 ? 'text-destructive animate-pulse' : 'text-muted-foreground'
              }`}
            />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div>
                <div
                  className={`text-2xl font-bold ${
                    (k?.totalOverdueLoans || 0) > 0 ? 'text-destructive' : 'text-foreground'
                  }`}
                >
                  {k?.totalOverdueLoans ?? 0}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
                  <span>{(k?.totalOverdueLoans || 0) > 0 ? 'Action required' : 'Zero delinquency'}</span>
                  <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* KPI 3: Interest Due This Month */}
        <Card
          className="hover:border-primary/50 transition-all cursor-pointer group shadow-sm"
          role="link" tabIndex={0}
          onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.click() }}
          onClick={() => navigate(`/payments?dueMonth=${currentMonthStr}`)}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Interest Due (Month)</CardTitle>
            <Clock className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div>
                <div className="text-2xl font-bold">{formatINR(k?.interestDueThisMonth || 0)}</div>
                <div className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
                  <span>Scheduled {format(now, 'MMM yyyy')}</span>
                  <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* KPI 4: Interest Collected This Month */}
        <Card
          className="hover:border-primary/50 transition-all cursor-pointer group shadow-sm"
          role="link" tabIndex={0}
          onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.click() }}
          onClick={() => navigate(`/payments?month=${currentMonthStr}`)}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Collected (Month)</CardTitle>
            <TrendingUp className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div>
                <div className="text-2xl font-bold text-emerald-600">{formatINR(k?.interestPaidThisMonth || 0)}</div>
                <div className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
                  <span>Realized earnings</span>
                  <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* KPI 5: Assets Held (Active + Overdue) */}
        <Card
          className="hover:border-primary/50 transition-all cursor-pointer group shadow-sm"
          role="link" tabIndex={0}
          onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.click() }}
          onClick={() => navigate('/assets')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Pledged Collateral</CardTitle>
            <Boxes className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition-transform" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div>
                <div className="text-2xl font-bold">{k?.totalAssetsHeldCount ?? 0} items</div>
                <div className="text-[10px] text-muted-foreground mt-1 truncate">
                  Gold: {k?.assetsBreakdown?.Gold?.count || 0} · Cars: {k?.assetsBreakdown?.Vehicles?.count || 0} · Deeds: {k?.assetsBreakdown?.Property?.count || 0}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* KPI 6: Delinquent Borrowers */}
        <Card
          className="hover:border-primary/50 transition-all cursor-pointer group shadow-sm"
          role="link" tabIndex={0}
          onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.click() }}
          onClick={() => navigate('/customers?overdue=true')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Delinquent Borrowers</CardTitle>
            <Users className="w-4 h-4 text-rose-500 group-hover:scale-110 transition-transform" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div>
                <div className="text-2xl font-bold">{k?.customersWithOverdueInterest ?? 0}</div>
                <div className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
                  <span>With overdue interest</span>
                  <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Visualizations Grid */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Chart A: Monthly Interest Collections Trend */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-semibold">Interest Earnings Trend</CardTitle>
              <CardDescription className="text-xs">
                Monthly interest collected from borrower repayment schedules.
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-md text-xs">
              <button
                className={`px-2.5 py-1 rounded transition-colors ${
                  trendMonths === 6 ? 'bg-background font-semibold shadow-xs' : 'text-muted-foreground'
                }`}
                onClick={() => setTrendMonths(6)}
              >
                6 Months
              </button>
              <button
                className={`px-2.5 py-1 rounded transition-colors ${
                  trendMonths === 12 ? 'bg-background font-semibold shadow-xs' : 'text-muted-foreground'
                }`}
                onClick={() => setTrendMonths(12)}
              >
                12 Months
              </button>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthlyData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                    onClick={(e) => {
                      if (e && 'activePayload' in e && Array.isArray((e as { activePayload?: Array<{ payload?: { key?: string } }> }).activePayload)) {
                        const item = (e as { activePayload?: Array<{ payload?: { key?: string } }> }).activePayload?.[0]?.payload
                        if (item?.key) navigate(`/payments?month=${item.key}`)
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => (val >= 1000 ? `₹${Math.round(val / 1000)}k` : `₹${val}`)}
                    />
                    <Tooltip
                      formatter={(val: number) => [formatINR(val), 'Interest Collected']}
                      labelFormatter={(label) => `Month: ${label}`}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                    />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} className="cursor-pointer" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chart B: Loan Status Breakdown (Donut Chart) */}
        <Card className="lg:col-span-1 shadow-sm flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Loan Portfolio Status</CardTitle>
            <CardDescription className="text-xs">Distribution across current loan lifecycle states.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between pt-2">
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <div className="h-52 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusPie}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      className="cursor-pointer"
                      onClick={(entry) => {
                        const entryKey = (entry as { key?: string })?.key
                        if (entryKey) navigate(`/loans?status=${entryKey}`)
                      }}
                    >
                      {statusPie.map((entry) => (
                        <Cell key={`cell-${entry.key}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number, name: string) => [`${val} loans`, name]}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Donut Center Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-bold">{totalStatusCount}</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</span>
                </div>
              </div>
            )}

            {/* Custom Status Legend */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t text-xs">
              {statusPie.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center gap-1.5 cursor-pointer hover:opacity-80"
                  onClick={() => navigate(`/loans?status=${item.key}`)}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="truncate text-muted-foreground">{item.name}:</span>
                  <span className="font-semibold">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Visualizations Grid: Origination Comparison & Collateral Mix */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Chart C: New Loan Value vs Collateral Value (Originations) */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">New Loan Value vs Collateral Value</CardTitle>
            <CardDescription className="text-xs">
              Monthly comparison of new principal disbursed versus pledged collateral market appraisal on a shared scale.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {isLoading ? (
              <Skeleton className="h-60 w-full" />
            ) : (
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={originationData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => (val >= 100000 ? `₹${Math.round(val / 100000)}L` : `₹${val / 1000}k`)}
                    />
                    <Tooltip
                      formatter={(val: number, name: string) => [
                        formatINR(val),
                        name === 'loanAmount' ? 'New Loan Principal' : 'Collateral Appraisal',
                      ]}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Legend
                      formatter={(value) => (value === 'loanAmount' ? 'New Principal Disbursed' : 'Appraised Collateral Value')}
                      wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                    />
                    <Bar dataKey="loanAmount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="collateralValue" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chart D: Held Collateral Mix */}
        <Card className="lg:col-span-1 shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Vault Collateral Mix</CardTitle>
            <CardDescription className="text-xs">
              Valuation breakdown of physical assets held in vault custody.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2 space-y-3.5">
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              assetMixData.map((item) => (
                <div key={item.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-muted-foreground">
                      {item.count} {item.count === 1 ? 'item' : 'items'} · {formatINR(item.totalValue)} ({item.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        item.key === 'Gold'
                          ? 'bg-amber-500'
                          : item.key === 'Vehicles'
                          ? 'bg-blue-500'
                          : item.key === 'Property'
                          ? 'bg-emerald-500'
                          : 'bg-purple-500'
                      }`}
                      style={{ width: `${Math.max(5, item.percentage)}%` }}
                    />
                  </div>
                </div>
              ))
            )}

            <div className="pt-3 border-t flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Total Pledged Value:</span>
              <span className="font-bold text-emerald-600">
                {formatINR(k?.totalAssetsHeldValue || 0)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Operational Alerts & Delinquency Section */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Alert 1: Overdue Loans & Delinquency Watch */}
        <Card className="shadow-sm border-destructive/30">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-4 h-4" /> Delinquency Watch ({data?.alerts.overdueLoansList?.length || 0})
              </CardTitle>
              <CardDescription className="text-xs">
                Borrowers with missed monthly dues, sorted by delinquency age.
              </CardDescription>
            </div>
            {(data?.alerts.overdueLoansList?.length || 0) > 0 && (
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => navigate('/loans?status=overdue')}>
                View All
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="space-y-3">
                {(data?.alerts.overdueLoansList || []).map((o) => {
                  const alreadySent = sentReminders.has(o.loan_id)
                  return (
                    <div
                      key={o.loan_id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 border border-destructive/20 bg-destructive/5 rounded-lg"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm truncate">{o.customer_name}</span>
                          <span className="text-xs text-muted-foreground font-mono">#{o.loan_id.slice(0, 8)}</span>
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {o.asset_type}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-destructive">
                            Overdue: {formatINR(o.overdue_amount)}
                          </span>
                          <span>· Delinquent: {o.days_overdue} days</span>
                          {o.unpaid_dues_count > 1 && (
                            <span className="bg-destructive/10 text-destructive px-1.5 py-0.5 rounded text-[10px] font-semibold">
                              {o.unpaid_dues_count} missed dues
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => navigate(`/loans?loan=${o.loan_id}`)}
                        >
                          Open Loan
                        </Button>
                        <Button
                          size="sm"
                          variant={alreadySent ? 'secondary' : 'destructive'}
                          className="h-8 text-xs"
                          disabled={alreadySent}
                          onClick={() => handleSendReminder(o.loan_id, o.customer_name)}
                        >
                          {alreadySent ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Reminded
                            </>
                          ) : (
                            <>
                              <Send className="w-3 h-3 mr-1" /> Remind
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )
                })}

                {(data?.alerts.overdueLoansList || []).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2 opacity-60" />
                    All borrowers are current with interest payments 🎉
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alert 2: Upcoming Interest Dues (Next 7 Days) */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" /> Interest Due This Week ({data?.alerts.upcomingDues?.length || 0})
              </CardTitle>
              <CardDescription className="text-xs">
                Scheduled payments maturing in the upcoming 7-day window.
              </CardDescription>
            </div>
            <Button size="sm" variant="ghost" className="text-xs" onClick={() => navigate('/payments')}>
              View Ledger
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="space-y-3">
                {(data?.alerts.upcomingDues || []).map((u) => (
                  <div
                    key={u.due_id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 border rounded-lg hover:bg-accent/40 transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">{u.customer_name}</span>
                        <span className="text-xs text-muted-foreground font-mono">#{u.loan_id.slice(0, 8)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="font-semibold text-foreground">{formatINR(u.amount)}</span>
                        <span>· Due: {format(parseISO(u.due_date), 'MMM dd, yyyy')}</span>
                        <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary">
                          {u.days_until_due === 0
                            ? 'Due Today'
                            : u.days_until_due === 1
                            ? 'Tomorrow'
                            : `In ${u.days_until_due} days`}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => navigate(`/loans?loan=${u.loan_id}`)}
                      >
                        Inspect
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        className="h-8 text-xs"
                        onClick={() => navigate('/payments?loan=' + encodeURIComponent(u.loan_id) + '&amount=' + u.amount)}
                      >
                        Record collection
                      </Button>
                    </div>
                  </div>
                ))}

                {(data?.alerts.upcomingDues || []).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No scheduled dues maturing in the next 7 days.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Action Modal: Add Customer */}
      <Dialog open={openCustomerModal} onOpenChange={setOpenCustomerModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Full Name *</label>
              <Input
                placeholder="e.g. Ramesh Chandra"
                value={customerForm.name}
                onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Phone (10 digits) *</label>
              <Input
                inputMode="numeric"
                placeholder="9876543210"
                value={customerForm.phone}
                onChange={(e) =>
                  setCustomerForm({
                    ...customerForm,
                    phone: e.target.value.replace(/[^0-9]/g, '').slice(0, 10),
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Address</label>
              <Input
                placeholder="e.g. Sector 4, Gandhinagar"
                value={customerForm.address}
                onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Notes</label>
              <Textarea
                placeholder="Customer details, references..."
                rows={2}
                value={customerForm.notes}
                onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCustomerModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCustomer} disabled={!customerForm.name || !customerForm.phone}>
              Save Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Action Modal: Add Loan */}
      <Dialog open={openLoanModal} onOpenChange={setOpenLoanModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Originate Pawn Loan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">Borrower *</label>
              <select
                className="w-full border rounded-md h-10 px-3 bg-background text-sm"
                value={loanForm.customer_id}
                onChange={(e) => setLoanForm({ ...loanForm, customer_id: e.target.value })}
              >
                <option value="">Select borrower from CRM...</option>
                {(data?.reference.customers || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Principal Amount (₹) *</label>
                <Input
                  type="number"
                  placeholder="200000"
                  value={loanForm.loan_amount}
                  onChange={(e) => setLoanForm({ ...loanForm, loan_amount: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Interest Rate (% / month) *</label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="2.0"
                  value={loanForm.interest_rate_percent}
                  onChange={(e) => setLoanForm({ ...loanForm, interest_rate_percent: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Collateral Type *</label>
                <Select
                  value={loanForm.asset_type}
                  onValueChange={(v) => setLoanForm({ ...loanForm, asset_type: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gold">Gold & Jewellery</SelectItem>
                    <SelectItem value="car">Vehicle / Automobile</SelectItem>
                    <SelectItem value="property">Property Documents</SelectItem>
                    <SelectItem value="other">Other Luxury Asset</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Appraised Collateral Value (₹)</label>
                <Input
                  type="number"
                  placeholder="300000"
                  value={loanForm.asset_value}
                  onChange={(e) => setLoanForm({ ...loanForm, asset_value: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Collateral Description *</label>
              <Textarea
                placeholder="Appraisal details, weight, condition..."
                rows={2}
                value={loanForm.asset_description}
                onChange={(e) => setLoanForm({ ...loanForm, asset_description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenLoanModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddLoan}
              disabled={!loanForm.customer_id || !loanForm.loan_amount || !loanForm.asset_description}
            >
              Originate Loan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Action Modal: Record Payment */}
      <Dialog open={openPaymentModal} onOpenChange={setOpenPaymentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment / Collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Select Loan *</label>
              <select
                className="w-full border rounded-md h-10 px-3 bg-background text-sm"
                value={paymentForm.loan_id}
                onChange={(e) => {
                  const lId = e.target.value
                  const match = data?.reference.loans.find((l) => l.id === lId)
                  setPaymentForm({
                    ...paymentForm,
                    loan_id: lId,
                    amount: match
                      ? String((match.remaining_principal * match.interest_rate_percent) / 100)
                      : paymentForm.amount,
                  })
                }}
              >
                <option value="">Select borrower loan...</option>
                {(data?.reference.payableLoans || []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {data.reference.customerMap.get(l.customer_id) || 'Borrower'} — {l.asset_type} (₹{l.remaining_principal.toLocaleString('en-IN')})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Payment Type</label>
              <Select
                value={paymentForm.type}
                onValueChange={(v: 'interest' | 'principal') => setPaymentForm({ ...paymentForm, type: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="interest">Interest Payment (Settles Due)</SelectItem>
                  <SelectItem value="principal">Principal Paydown</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Amount (₹) *</label>
              <Input
                type="number"
                placeholder="5000"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenPaymentModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddPayment} aria-busy={posting} disabled={!paymentForm.loan_id || !Number(paymentForm.amount)}>
              Save Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Action Modal: Send Reminder */}
      <Dialog open={openReminderModal} onOpenChange={setOpenReminderModal}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send Delinquency Reminder</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {(data?.alerts.overdueLoansList || []).map((o) => (
              <div key={o.loan_id} className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <div className="font-semibold text-sm">{o.customer_name}</div>
                  <div className="text-xs text-muted-foreground">
                    Loan #{o.loan_id.slice(0, 6)} · {formatINR(o.overdue_amount)} ({o.days_overdue} days overdue)
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={sentReminders.has(o.loan_id)}
                  onClick={() => handleSendReminder(o.loan_id, o.customer_name)}
                >
                  {sentReminders.has(o.loan_id) ? 'Dispatched' : 'Send'}
                </Button>
              </div>
            ))}
            {(data?.alerts.overdueLoansList || []).length === 0 && (
              <div className="text-center py-6 text-sm text-muted-foreground">
                No delinquent loans requiring payment reminders.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
