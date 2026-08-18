import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { getProvider } from '@/data'
import { formatINR } from '@/lib/dashboardCalculations'
import { ExportButtons } from '@/components/ExportButtons'
import { Boxes, ShieldCheck, ArrowRight } from 'lucide-react'

export default function AssetInventory() {
  const { orgId } = useAuth()
  const navigate = useNavigate()
  const provider = getProvider()

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', orgId],
    queryFn: async () => orgId ? provider.customers.list(orgId) : [],
    enabled: !!orgId,
  })

  const customerMap = new Map(customers.map(c => [c.id, c.name]))

  const { data = [], isLoading } = useQuery({
    queryKey: ['assets-held', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const loans = await provider.loans.list(orgId)
      // Held assets = active, overdue, defaulted (strictly exclude closed)
      return loans
        .filter(l => l.status === 'active' || l.status === 'overdue' || l.status === 'defaulted')
        .map(l => ({
          id: l.id,
          customer_id: l.customer_id,
          customer_name: customerMap.get(l.customer_id) || 'Borrower',
          asset_type: l.asset_type || 'Other',
          asset_description: l.asset_description || 'Pledged asset',
          asset_value: Number(l.asset_value || 0),
          loan_amount: Number(l.loan_amount || 0),
          remaining_principal: Number(l.remaining_principal || 0),
          status: l.status,
          start_date: l.start_date,
        }))
        .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
    },
    enabled: !!orgId,
  })

  useEffect(() => {
    document.title = 'Asset & Collateral Inventory | PawnTrack'
  }, [])

  const totalCollateralValue = data.reduce((sum, a) => sum + a.asset_value, 0)
  const totalLoanExposure = data.reduce((sum, a) => sum + a.remaining_principal, 0)

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pledged Collateral Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Audit of all assets currently held in the vault across active and overdue loans.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButtons data={data} filename="collateral-inventory" />
          <Button variant="outline" onClick={() => navigate('/reports')}>
            View Reports
          </Button>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs text-muted-foreground font-medium">Total Collateral Held</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{data.length} items</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs text-muted-foreground font-medium">Total Appraised Value</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-emerald-600">{formatINR(totalCollateralValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs text-muted-foreground font-medium">Total Principal Exposure</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-primary">{formatINR(totalLoanExposure)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vault Assets Register ({data.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <div className="divide-y">
              {data.map((a) => (
                <div key={a.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-base capitalize">{a.asset_type}</span>
                      <Badge variant="outline" className="text-xs">
                        Valuation: {formatINR(a.asset_value)}
                      </Badge>
                      <Badge
                        variant={a.status === 'active' ? 'default' : a.status === 'overdue' ? 'destructive' : 'secondary'}
                        className="text-xs capitalize"
                      >
                        {a.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-foreground/80 font-medium">
                      {a.asset_description}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span>Borrower: {a.customer_name}</span>
                      <span>· Principal Outstanding: {formatINR(a.remaining_principal)}</span>
                      <span className="font-mono">· Loan #{a.id.slice(0, 8)}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 self-start sm:self-center"
                    onClick={() => navigate(`/loans?loan=${a.id}`)}
                  >
                    Inspect Loan <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              ))}
              {data.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No collateral currently held in vault.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
