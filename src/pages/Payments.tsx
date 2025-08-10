import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/useAuth'
import { enqueue } from '@/lib/offlineQueue'

export default function Payments() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { orgId } = useAuth()
  const { data: loans } = useQuery({ queryKey: ['loans'], queryFn: async () => (await supabase.from('loans').select('id, asset_type, loan_amount')).data || [] })
  const { data: payments } = useQuery({ queryKey: ['payments'], queryFn: async () => (await supabase.from('payments').select('*').order('created_at', { ascending: false })).data || [] })

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

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="md:col-span-1">
        <CardHeader><CardTitle>New payment</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={addPayment} className="space-y-3">
            <select value={form.loan_id} onChange={e => setForm({ ...form, loan_id: e.target.value })} className="w-full border rounded-md h-10 px-3 bg-background">
              <option value="">Select loan</option>
              {(loans || []).map(l => <option key={l.id} value={l.id}>{l.asset_type} — ${l.loan_amount}</option>)}
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
      <Card className="md:col-span-2">
        <CardHeader><CardTitle>Payments</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(payments || []).map(p => (
              <div key={p.id} className="border rounded-md p-3">
                <div className="font-medium">${p.amount} — {p.type}</div>
                <div className="text-sm text-muted-foreground">{p.payment_date}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
