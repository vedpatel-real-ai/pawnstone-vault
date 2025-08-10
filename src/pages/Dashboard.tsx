import { useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'

export default function Dashboard() {
  const { orgId } = useAuth()
  const { data: stats } = useQuery({
    queryKey: ['dashboard', orgId],
    queryFn: async () => {
      const [{ count: loans }, { count: customers }, { data: dues }] = await Promise.all([
        supabase.from('loans').select('*', { count: 'exact', head: true }).eq('org_id', orgId!),
        supabase.from('customers').select('*', { count: 'exact', head: true }).eq('org_id', orgId!),
        supabase.from('dues').select('id, due_date, amount, status').eq('org_id', orgId!).order('due_date', { ascending: true }).limit(5),
      ])
      return { loans: loans || 0, customers: customers || 0, dues: dues || [] }
    },
    enabled: !!orgId,
  })

  useEffect(() => { document.title = 'PawnTrack Dashboard' }, [])

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card>
        <CardHeader><CardTitle>Total Loans</CardTitle></CardHeader>
        <CardContent className="text-3xl font-semibold">{stats?.loans ?? '-'}</CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Customers</CardTitle></CardHeader>
        <CardContent className="text-3xl font-semibold">{stats?.customers ?? '-'}</CardContent>
      </Card>
      <Card className="md:col-span-3">
        <CardHeader><CardTitle>Upcoming & Overdue Dues</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats?.dues?.map((d) => (
              <div key={d.id} className={d.status === 'overdue' ? 'text-destructive' : ''}>
                {d.due_date}: ${d.amount} — {d.status}
              </div>
            )) || '—'}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
