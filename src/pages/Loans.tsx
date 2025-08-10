import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/useAuth'
import { addMonths, format } from 'date-fns'
import { ExportButtons } from '@/components/ExportButtons'
import { enqueue } from '@/lib/offlineQueue'

export default function Loans() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { orgId } = useAuth()
  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: async () => (await supabase.from('customers').select('id, name')).data || [] })
  const { data: loans } = useQuery({ queryKey: ['loans'], queryFn: async () => (await supabase.from('loans').select('*').order('created_at', { ascending: false })).data || [] })

  const [form, setForm] = useState({ customer_id: '', asset_type: 'gold', asset_description: '', asset_value: '', loan_amount: '', interest_rate_percent: '2.5', start_date: format(new Date(), 'yyyy-MM-dd'), term_months: '12' })
  const canSave = useMemo(() => form.customer_id && Number(form.loan_amount) > 0, [form])

  useEffect(() => { document.title = 'Loans | PawnTrack' }, [])

  const addLoan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId) {
      toast({ title: 'Organization not set', description: 'Please sign in again.' })
      return
    }
    const nextDue = format(addMonths(new Date(form.start_date), 1), 'yyyy-MM-dd')
    const payload = {
      org_id: orgId,
      customer_id: form.customer_id,
      asset_type: form.asset_type,
      asset_description: form.asset_description,
      asset_value: Number(form.asset_value || 0),
      loan_amount: Number(form.loan_amount),
      remaining_principal: Number(form.loan_amount),
      interest_rate_percent: Number(form.interest_rate_percent),
      start_date: form.start_date,
      term_months: Number(form.term_months),
      next_due_date: nextDue,
      status: 'active' as const,
    }
    try {
      const { error } = await supabase.from('loans').insert(payload)
      if (error) throw error
      toast({ title: 'Loan created' })
      setForm({ ...form, asset_description: '', asset_value: '', loan_amount: '' })
      qc.invalidateQueries({ queryKey: ['loans'] })
    } catch (err) {
      await enqueue({ id: crypto.randomUUID(), type: 'create_loan', payload })
      toast({ title: 'Offline', description: 'Saved locally. Will sync when online.' })
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="md:col-span-1">
        <CardHeader><CardTitle>New loan</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={addLoan} className="space-y-3">
            <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>
                {(customers || []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={form.asset_type} onValueChange={(v) => setForm({ ...form, asset_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gold">Gold</SelectItem>
                <SelectItem value="car">Car</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Asset description" value={form.asset_description} onChange={e => setForm({ ...form, asset_description: e.target.value })} />
            <Input placeholder="Asset value" type="number" value={form.asset_value} onChange={e => setForm({ ...form, asset_value: e.target.value })} />
            <Input placeholder="Loan amount" type="number" value={form.loan_amount} onChange={e => setForm({ ...form, loan_amount: e.target.value })} required />
            <Input placeholder="Interest rate % per month" type="number" step="0.001" value={form.interest_rate_percent} onChange={e => setForm({ ...form, interest_rate_percent: e.target.value })} />
            <Input placeholder="Start date" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
            <Input placeholder="Term (months)" type="number" value={form.term_months} onChange={e => setForm({ ...form, term_months: e.target.value })} />
            <Button type="submit" disabled={!canSave}>Create</Button>
          </form>
        </CardContent>
      </Card>
      <Card className="md:col-span-2">
        <CardHeader className="flex items-center justify-between"><CardTitle>Loans</CardTitle>
          <ExportButtons data={loans || []} filename="loans" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(loans || []).map(l => (
              <div key={l.id} className="border rounded-md p-3">
                <div className="font-medium">{l.asset_type} — ${l.loan_amount} @ {l.interest_rate_percent}%</div>
                <div className="text-sm text-muted-foreground">Next due: {l.next_due_date} · Status: {l.status}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
