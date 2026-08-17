import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { getProvider } from '@/data'

export default function Notifications() {
  const { orgId } = useAuth()
  const provider = getProvider()

  const { data = [] } = useQuery({
    queryKey: ['notifications', orgId],
    queryFn: async () => orgId ? provider.notifications.list(orgId) : [],
    enabled: !!orgId,
  })

  useEffect(() => { document.title = 'Notifications | PawnTrack' }, [])

  return (
    <div className="space-y-2">
      {data.map(n => (
        <div key={n.id} className="border rounded-md p-3">
          <div className="font-medium">{n.title}</div>
          <div className="text-sm text-muted-foreground">{n.body}</div>
        </div>
      ))}
      {data.length === 0 && (
        <div className="text-sm text-muted-foreground">No notifications.</div>
      )}
    </div>
  )
}
