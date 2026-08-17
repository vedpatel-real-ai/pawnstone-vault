import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ExportButtons } from '@/components/ExportButtons'
import { useAuth } from '@/hooks/useAuth'
import { getProvider } from '@/data'

export default function Reports() {
  const { orgId } = useAuth()
  const provider = getProvider()

  const { data: loans = [] } = useQuery({
    queryKey: ['loans-report', orgId],
    queryFn: async () => orgId ? provider.loans.list(orgId) : [],
    enabled: !!orgId,
  })

  const { data: dues = [] } = useQuery({
    queryKey: ['dues-report', orgId],
    queryFn: async () => orgId ? provider.dues.list(orgId) : [],
    enabled: !!orgId,
  })

  useEffect(() => { document.title = 'Reports | PawnTrack' }, [])

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2 font-semibold">Loans report</div>
        <ExportButtons data={loans} filename="loans-report" />
      </section>
      <section>
        <div className="mb-2 font-semibold">Interest dues report</div>
        <ExportButtons data={dues} filename="interest-dues-report" />
      </section>
    </div>
  )
}
