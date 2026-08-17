import { useEffect, useState } from 'react'
import { getProvider } from '@/data'
import { isDemo } from '@/data/dataProvider'
import type { AppSession } from '@/data/types'

export function useAuth() {
  const provider = getProvider()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<AppSession | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)

  useEffect(() => {
    provider.getSession().then((s) => {
      setSession(s)
      setLoading(false)
    })
    const unsub = provider.onAuthStateChange((s) => {
      setSession(s)
    })
    return unsub
  }, [provider])

  useEffect(() => {
    if (!session?.user) { setOrgId(null); return }
    provider.getOrgId(session.user.id).then((id) => {
      if (id) setOrgId(id)
    })
  }, [session?.user?.id, provider])

  // Generate dues on login for demo mode
  useEffect(() => {
    if (isDemo() && orgId && provider.generateDues) {
      provider.generateDues(orgId)
    }
  }, [orgId, provider])

  return { loading, session, orgId, isDemo: isDemo() }
}
