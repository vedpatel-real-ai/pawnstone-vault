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
      // Ensure profile exists
      await supabase.from('profiles').upsert({ id: session.user.id })
      // Create or fetch a default organization for this user via RPC (idempotent)
      const { data: rpcOrgId } = await supabase.rpc('create_org_for_current_user', { p_name: 'My Organization' })
      if (rpcOrgId) {
        setOrgId(rpcOrgId as unknown as string)
      }
    })
  }, [session?.user?.id])

  return { loading, session, orgId }
}
