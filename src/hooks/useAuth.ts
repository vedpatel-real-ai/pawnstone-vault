import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'

export function useAuth() {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']>(null)
  const [orgId, setOrgId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) { setOrgId(null); return }
    supabase.from('profiles').select('org_id').eq('id', session.user.id).maybeSingle().then(async ({ data }) => {
      if (data?.org_id) { setOrgId(data.org_id); return }
      // If profile missing, create one in the first org
      const { data: org } = await supabase.from('organizations').select('id').limit(1).single()
      if (org?.id) {
        await supabase.from('profiles').upsert({ id: session.user.id, org_id: org.id })
        setOrgId(org.id)
      }
    })
  }, [session?.user?.id])

  return { loading, session, orgId }
}
