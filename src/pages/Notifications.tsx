import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { getProvider } from '@/data'
import { Bell, AlertTriangle, Info, CheckCircle2, ArrowRight } from 'lucide-react'
import { format, parseISO } from 'date-fns'

export default function Notifications() {
  const { orgId } = useAuth()
  const navigate = useNavigate()
  const provider = getProvider()

  const { data = [], isLoading,isError } = useQuery({
    queryKey: ['notifications', orgId],
    queryFn: async () => orgId ? provider.notifications.list(orgId) : [],
    enabled: !!orgId,
  })

  useEffect(() => {
    document.title = 'Vault Notifications & Alerts | PawnTrack'
  }, [])

  if (isLoading) return <p>Loading notifications…</p>
  if (isError) return <p role="alert">Could not load notifications.</p>

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vault Notifications & Alerts</h1>
          <p className="text-sm text-muted-foreground">
            System generated alerts, delinquency notices, and payment reminders.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {data.length} total messages
        </Badge>
      </div>

      <div className="space-y-3">
        {data.map((n) => {
          const isDelinquent = n.title.toLowerCase().includes('delinquency') || n.title.toLowerCase().includes('overdue')
          const isSuccess = n.title.toLowerCase().includes('closed') || n.title.toLowerCase().includes('settled')

          return (
            <Card
              key={n.id}
              className={`transition-all ${
                isDelinquent ? 'border-destructive/40 bg-destructive/5' : ''
              }`}
            >
              <CardContent className="p-4 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 shrink-0">
                    {isDelinquent ? (
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                    ) : isSuccess ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <Bell className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{n.title}</span>
                      {n.sent_at && (
                        <span className="text-xs text-muted-foreground">
                          · {format(parseISO(n.sent_at), 'MMM dd, yyyy · hh:mm a')}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">{n.body}</div>
                  </div>
                </div>

                {n.loan_id && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 self-center text-xs"
                    onClick={() => navigate(`/loans?loan=${n.loan_id}`)}
                  >
                    View Loan <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}

        {data.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No notifications at this time.</p>
          </div>
        )}
      </div>
    </div>
  )
}
