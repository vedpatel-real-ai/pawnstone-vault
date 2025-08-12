import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/useAuth'
import { enqueue } from '@/lib/offlineQueue'
import { useLocation } from 'react-router-dom'
import { endOfMonth, format, parseISO, startOfMonth } from 'date-fns'

export default function Payments() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { orgId } = useAuth()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const monthParam = params.get('month') // YYYY-MM
  const dueMonthParam = params.get('dueMonth') // YYYY-MM for dues view

  const { data: loans } = useQuery({ queryKey: ['loans'], queryFn: async () => (await supabase.from('loans').select('id, asset_type, loan_amount')).data || [] })
  const { data: payments } = useQuery({ queryKey: ['payments'], queryFn: async () => (await supabase.from('payments').select('*').order('created_at', { ascending: false })).data || [] })

  const { data: duesForMonth } = useQuery({
    queryKey: ['dues-month', orgId, dueMonthParam],
    queryFn: async () => {
      if (!orgId || !dueMonthParam) return []
      const start = `${dueMonthParam}-01`
      const end = format(endOfMonth(parseISO(start)), 'yyyy-MM-dd')
      const { data } = await supabase
        .from('dues')
        .select('id, loan_id, amount, due_date, status, due_type')
        .eq('org_id', orgId)
        .eq('due_type', 'interest')
        .in('status', ['pending', 'overdue'])
        .gte('due_date', start)
        .lte('due_date', end)
        .order('due_date', { ascending: true })
      return data || []
    },
    enabled: !!orgId && !!dueMonthParam,
  })

  const [form, setForm] = useState({ loan_id: '', amount: '', type: 'interest' })
  const canSave = useMemo(() => form.loan_id && Number(form.amount) > 0, [form])

  useEffect(() => { document.title = 'Payments | PawnTrack' }, [])

  const addPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId) {
      toast({ title: 'Organization not set', description: 'Please sign in again.' })
      return
    }
    const payload = { loan_id: form.loan_id, amount: Number(form.amount), type: form.type as any, org_id: orgId }
    try {
      const { error } = await supabase.from('payments').insert(payload)
      if (error) throw error
      toast({ title: 'Payment recorded' })
      setForm({ loan_id: '', amount: '', type: 'interest' })
      qc.invalidateQueries({ queryKey: ['payments'] })
    } catch (err) {
      await enqueue({ id: crypto.randomUUID(), type: 'create_payment', payload })
      toast({ title: 'Offline', description: 'Saved locally. Will sync when online.' })
    }
  }

  const visiblePayments = useMemo(() => {
    if (!monthParam) return payments || []
    const start = parseISO(`${monthParam}-01`)
    const end = endOfMonth(start)
    return (payments || []).filter((p: any) => {
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
              {(loans || []).map((l: any) => <option key={l.id} value={l.id}>{l.asset_type} — ${l.loan_amount}</option>)}
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
                {(duesForMonth || []).map((d: any) => (
                  <div key={d.id} className={d.status === 'overdue' ? 'text-destructive' : ''}>
                    {d.due_date}: ${d.amount} — {d.status}
                  </div>
                ))}
                {(duesForMonth || []).length === 0 && (
                  <div className="text-sm text-muted-foreground">No interest dues for this month.</div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader><CardTitle>Payments{monthParam ? ` — ${monthParam}` : ''}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(visiblePayments || []).map((p: any) => (
                <div key={p.id} className="border rounded-md p-3">
                  <div className="font-medium">${p.amount} — {p.type}</div>
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
