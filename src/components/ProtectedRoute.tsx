import { Navigate } from 'react-router-dom'
import { PropsWithChildren } from 'react'
import { useAuth } from '@/hooks/useAuth'

export default function ProtectedRoute({ children }: PropsWithChildren) {
  const { loading, session } = useAuth()
  if (loading) return <div className="p-8">Loading...</div>
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}
