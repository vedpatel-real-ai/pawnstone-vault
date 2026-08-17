import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/useAuth'
import { useLocation } from 'react-router-dom'
import { endOfMonth, format, parseISO, startOfMonth } from 'date-fns'
import { getProvider } from '@/data'

export default function Payments() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { orgId } = useAuth()
  const location = useLocation()
  const provider = getProvider()
  const params = new URLSearchParams(location.search)
  const monthParam = params.get('month')
  const dueMonthParam = params.get('dueMonth')

  const { data: loans } = useQuery({
    queryKey: ['loans'],
    queryFn: async () => orgId ? provider.loans.list(orgId) : [],
    enabled: !!orgId,
  })

  const { data: payments } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => orgId ? provider.payments.list(orgId) : [],
    enabled: !!orgId,
  })

  const { data: duesForMonth } = useQuery({
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

  const [form, setForm] = useState({ loan_id: '', amount: '', type: 'interest' })
  const canSave = useMemo(() => form.loan_id && Number(form.amount) > 0, [form])

  useEffect(() => { document.title = 'Payments | PawnTrack' }, [])

  const addPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId) { toast({ title: 'Organization not set', description: 'Please sign in again.' }); return }
    try {
      await provider.payments.create({ loan_id: form.loan_id, amount: Number(form.amount), type: form.type as any, org_id: orgId, payment_date: format(new Date(), 'yyyy-MM-dd'), notes: null })
      toast({ title: 'Payment recorded' })
      setForm({ loan_id: '', amount: '', type: 'interest' })
      qc.invalidateQueries({ queryKey: ['payments'] })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to record', variant: 'destructive' })
    }
  }

  const visiblePayments = useMemo(() => {
    if (!monthParam) return payments || []
    const start = parseISO(`${monthParam}-01`)
    const end = endOfMonth(start)
    return (payments || []).filter(p => {
      const d = parseISO(p.payment_date)
      return d >= start && d <= end
    })
  }, [payments, monthParam])

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="md:col-span-1">
        <CardHeader><CardTitle>New payment</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={addPayment} className="space-y-3">
            <select value={form.loan_id} onChange={e => setForm({ ...form, loan_id: e.target.value })} className="w-full border rounded-md h-10 px-3 bg-background">
              <option value="">Select loan</option>
              {(loans || []).map(l => <option key={l.id} value={l.id}>{l.asset_type} — ₹{l.loan_amount}</option>)}
            </select>
            <Input placeholder="Amount" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full border rounded-md h-10 px-3 bg-background">
              <option value="interest">Interest</option>
              <option value="principal">Principal</option>
              <option value="other">Other</option>
            </select>
            <Button type="submit" disabled={!canSave}>Record</Button>
          </form>
        </CardContent>
      </Card>
      <div className="md:col-span-2 space-y-6">
        {dueMonthParam && (
          <Card>
            <CardHeader><CardTitle>Interest Due — {dueMonthParam}</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(duesForMonth || []).map(d => (
                  <div key={d.id} className={d.status === 'overdue' ? 'text-destructive' : ''}>
                    {d.due_date}: ₹{d.amount} — {d.status}
                  </div>
                ))}
                {(duesForMonth || []).length === 0 && <div className="text-sm text-muted-foreground">No interest dues for this month.</div>}
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader><CardTitle>Payments{monthParam ? ` — ${monthParam}` : ''}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(visiblePayments || []).map(p => (
                <div key={p.id} className="border rounded-md p-3">
                  <div className="font-medium">₹{p.amount} — {p.type}</div>
                  <div className="text-sm text-muted-foreground">{p.payment_date}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
