import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { ExportButtons } from '@/components/ExportButtons'
import { enqueue } from '@/lib/offlineQueue'

export default function Customers() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['customers'], queryFn: async () => (await supabase.from('customers').select('*').order('created_at', { ascending: false })).data || [] })

  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' })
  const canSave = useMemo(() => form.name.trim().length > 1, [form])

  useEffect(() => { document.title = 'Customers | PawnTrack' }, [])

  const addCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = { ...form }
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
        <CardHeader className="flex items-center justify-between"><CardTitle>Customers</CardTitle>
          <ExportButtons data={data || []} filename="customers" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(data || []).map(c => (
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
