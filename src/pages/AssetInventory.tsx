import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { getProvider } from '@/data'

// Asset Inventory page showing active assets
export default function AssetInventory() {
  const { orgId } = useAuth()
  const navigate = useNavigate()
  const provider = getProvider()

  const { data = [], isLoading } = useQuery({
    queryKey: ['assets', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const loans = await provider.loans.list(orgId)
      return loans
        .filter(l => l.status === 'active')
        .map(l => ({
          id: l.id,
          customer_id: l.customer_id,
          asset_type: l.asset_type,
          asset_description: l.asset_description,
          asset_value: l.asset_value,
          start_date: l.start_date,
        }))
        .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
    },
    enabled: !!orgId,
  })

  useEffect(() => {
    document.title = 'Asset Inventory | PawnTrack'
    const meta = document.querySelector("meta[name='description']") as HTMLMetaElement | null
    if (meta) meta.content = 'Current pledged assets and linked loans — Asset Inventory report.'
  }, [])

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Asset Inventory Report</h1>
        <Button variant="outline" onClick={() => navigate('/reports')}>Go to Reports</Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Currently Held Assets</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <div className="divide-y">
              {data.map((a: any) => (
                <div key={a.id} className="py-4 flex items-start justify-between">
                  <div>
                    <div className="font-medium">{a.asset_type || 'Other'} — ₹{Number(a.asset_value || 0).toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">{a.asset_description || 'No description'}</div>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => navigate(`/loans?loan=${a.id}`)}>View loan</Button>
                </div>
              ))}
              {data.length === 0 && (
                <div className="text-sm text-muted-foreground">No active assets.</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
