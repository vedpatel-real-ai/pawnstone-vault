import { useEffect, useState, type PropsWithChildren } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AuthContext } from '@/hooks/useAuth'
import { getProvider } from '@/data'
import { isDemo } from '@/data/dataProvider'
import type { AppSession } from '@/data/types'

export function AuthProvider({ children }: PropsWithChildren) {
  const queries = useQueryClient()
  const [session,setSession] = useState<AppSession | null>(null)
  const [orgId,setOrg] = useState<string | null>(null)
  const [loading,setLoading] = useState(true)
  const [failed,setFailed] = useState(false)
  useEffect(() => {
    const provider = getProvider()
    let revision = 0
    let userId: string | null | undefined
    let mounted = true
    function change(next: AppSession | null) {
      if (!mounted || userId === (next?.user.id ?? null)) return
      userId = next?.user.id ?? null
      const current = ++revision
      queries.clear()
      setSession(next)
      setOrg(null)
      setFailed(false)
      setLoading(!!next)
      // Auth callbacks must release the Supabase auth lock before making API calls.
      if (next) void Promise.resolve().then(() => provider.getOrgId(next.user.id)).then(org => {
        if (mounted && revision === current) {
          setOrg(org)
          setFailed(!org)
          setLoading(false)
        }
      }).catch(() => { if (mounted && revision === current) setFailed(true) })
    }
    const unsub = provider.onAuthStateChange(change)
    provider.getSession().then(s => { if (!revision) change(s) }).catch(() => { if (mounted && !revision) setFailed(true) })
    return () => { mounted = false; unsub() }
  },[queries])
  if (failed) return <main role="alert" className="container py-8">Could not open your organization. <button onClick={() => location.reload()}>Retry</button></main>
  return <AuthContext.Provider value={{session,orgId,loading,isDemo:isDemo()}}>{children}</AuthContext.Provider>
}
