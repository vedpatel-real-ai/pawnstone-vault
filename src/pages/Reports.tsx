import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ExportButtons } from '@/components/ExportButtons'
import { useAuth } from '@/hooks/useAuth'
import { getProvider } from '@/data'
import { FileSpreadsheet, DollarSign, Users, ShieldCheck } from 'lucide-react'

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

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-report', orgId],
    queryFn: async () => orgId ? provider.customers.list(orgId) : [],
    enabled: !!orgId,
  })

  const { data: payments = [] } = useQuery({
    queryKey: ['payments-report', orgId],
    queryFn: async () => orgId ? provider.payments.list(orgId) : [],
    enabled: !!orgId,
  })

  useEffect(() => {
    document.title = 'Reports & Data Exports | PawnTrack'
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports & Data Exports</h1>
        <p className="text-sm text-muted-foreground">
          Export portfolio reports, payment registers, and customer records to CSV or JSON.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" /> Loans Portfolio Report
            </CardTitle>
            <CardDescription>
              Complete export of all {loans.length} loans including principal amounts, interest rates, and status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExportButtons data={loans} filename="loans-portfolio-report" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" /> Interest & Dues Schedule
            </CardTitle>
            <CardDescription>
              Scheduled, pending, overdue, and paid monthly dues list ({dues.length} records).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExportButtons data={dues} filename="interest-dues-report" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" /> Collections & Payment Ledger
            </CardTitle>
            <CardDescription>
              Complete payment history ({payments.length} transactions) across interest and principal receipts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExportButtons data={payments} filename="payments-ledger-report" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-600" /> Customer & Borrower Directory
            </CardTitle>
            <CardDescription>
              Customer master data ({customers.length} records) with contact details and identification numbers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExportButtons data={customers} filename="customers-directory" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
