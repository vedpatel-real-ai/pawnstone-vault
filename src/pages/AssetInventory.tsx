import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { addMonths, eachMonthOfInterval, endOfMonth, format, isWithinInterval, startOfMonth, subMonths } from 'date-fns'
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { AlertTriangle, BadgeDollarSign, Banknote, PieChart as PieIcon, TrendingUp, Users, Boxes } from 'lucide-react'

// Minimal Asset Inventory page showing active assets
export default function AssetInventory() {
  const { orgId } = useAuth()
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['assets', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data } = await supabase
        .from('loans')
        .select('id, customer_id, asset_type, asset_description, asset_value, start_date')
        .eq('org_id', orgId)
        .eq('status', 'active')
        .order('start_date', { ascending: false })
      return data || []
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
              {(data || []).map((a: any) => (
                <div key={a.id} className="py-4 flex items-start justify-between">
                  <div>
                    <div className="font-medium">{a.asset_type || 'Other'} — ${a.asset_value || 0}</div>
                    <div className="text-sm text-muted-foreground">{a.asset_description || 'No description'}</div>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => navigate(`/loans?loan=${a.id}`)}>View loan</Button>
                </div>
              ))}
              {(data || []).length === 0 && (
                <div className="text-sm text-muted-foreground">No active assets.</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
