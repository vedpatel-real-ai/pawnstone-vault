import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { ExportButtons } from '@/components/ExportButtons'

export default function Reports() {
  const { data: loans } = useQuery({ queryKey: ['loans'], queryFn: async () => (await supabase.from('loans').select('*')).data || [] })
  const { data: dues } = useQuery({ queryKey: ['dues'], queryFn: async () => (await supabase.from('dues').select('*')).data || [] })
  useEffect(() => { document.title = 'Reports | PawnTrack' }, [])
  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2 font-semibold">Loans report</div>
        <ExportButtons data={loans || []} filename="loans-report" />
      </section>
      <section>
        <div className="mb-2 font-semibold">Interest dues report</div>
        <ExportButtons data={dues || []} filename="interest-dues-report" />
      </section>
    </div>
  )
}
