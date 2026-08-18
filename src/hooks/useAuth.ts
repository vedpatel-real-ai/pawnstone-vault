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

  const userId = session?.user?.id
  useEffect(() => {
    if (!userId) { setOrgId(null); return }
    provider.getOrgId(userId).then((id) => {
      if (id) setOrgId(id)
    })
  }, [userId, provider])

  // Generate dues on login for demo mode
  useEffect(() => {
    if (isDemo() && orgId && provider.generateDues) {
      provider.generateDues(orgId)
    }
  }, [orgId, provider])

  return { loading, session, orgId, isDemo: isDemo() }
}
