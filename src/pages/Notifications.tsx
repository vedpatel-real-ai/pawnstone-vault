import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export default function Notifications() {
  const { data } = useQuery({ queryKey: ['notifications'], queryFn: async () => (await supabase.from('notifications').select('*').order('created_at', { ascending: false })).data || [] })
  useEffect(() => { document.title = 'Notifications | PawnTrack' }, [])
  return (
    <div className="space-y-2">
      {(data || []).map(n => (
        <div key={n.id} className="border rounded-md p-3">
          <div className="font-medium">{n.title}</div>
          <div className="text-sm text-muted-foreground">{n.body}</div>
        </div>
      ))}
    </div>
  )
}
