import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/useAuth'
import { ExportButtons } from '@/components/ExportButtons'
import { enqueue } from '@/lib/offlineQueue'
import { useLocation } from 'react-router-dom'

export default function Customers() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { orgId } = useAuth()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const overdueParam = params.get('overdue') === 'true'

  const { data } = useQuery({ queryKey: ['customers'], queryFn: async () => (await supabase.from('customers').select('*').order('created_at', { ascending: false })).data || [] })

  const { data: overdueCustomerIds } = useQuery({
    queryKey: ['overdue-customer-ids', orgId],
    queryFn: async () => {
      if (!orgId) return new Set<string>()
      const { data: overdueDues } = await supabase
        .from('dues')
        .select('loan_id')
        .eq('org_id', orgId)
        .eq('status', 'overdue')
        .eq('due_type', 'interest')
      const loanIds = Array.from(new Set((overdueDues || []).map((d: any) => d.loan_id).filter(Boolean)))
      if (loanIds.length === 0) return new Set<string>()
      const { data: loans } = await supabase
        .from('loans')
        .select('id, customer_id')
        .in('id', loanIds)
      return new Set<string>((loans || []).map((l: any) => l.customer_id))
    },
    enabled: !!orgId,
  })

  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' })
  const canSave = useMemo(() => form.name.trim().length > 1, [form])

  useEffect(() => { document.title = 'Customers | PawnTrack' }, [])

  const addCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId) {
      toast({ title: 'Organization not set', description: 'Please sign in again.' })
      return
    }
    const payload = { ...form, org_id: orgId }
    try {
      const { error } = await supabase.from('customers').insert(payload)
      if (error) throw error
      toast({ title: 'Customer added' })
      setForm({ name: '', email: '', phone: '', address: '' })
      qc.invalidateQueries({ queryKey: ['customers'] })
    } catch (err) {
      await enqueue({ id: crypto.randomUUID(), type: 'create_customer', payload })
      toast({ title: 'Offline', description: 'Saved locally. Will sync when online.' })
    }
  }

  const visibleCustomers = useMemo(() => {
    if (!overdueParam) return data || []
    const set = overdueCustomerIds || new Set<string>()
    return (data || []).filter((c: any) => set.has(c.id))
  }, [data, overdueParam, overdueCustomerIds])

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="md:col-span-1">
        <CardHeader><CardTitle>New customer</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={addCustomer} className="space-y-3">
            <Input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            <Input placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <Input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <Input placeholder="Address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            <Button type="submit" disabled={!canSave}>Add</Button>
          </form>
        </CardContent>
      </Card>
      <Card className="md:col-span-2">
        <CardHeader className="flex items-center justify-between"><CardTitle>Customers{overdueParam ? ' — Overdue interest' : ''}</CardTitle>
          <ExportButtons data={visibleCustomers || []} filename="customers" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(visibleCustomers || []).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between border rounded-md p-3">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-sm text-muted-foreground">{c.email} · {c.phone}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
