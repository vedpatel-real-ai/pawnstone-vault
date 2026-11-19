import { useState } from 'react'
import { getProvider } from '@/data'
import { isDemo } from '@/data/dataProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function Login() {
  const { toast } = useToast()
  const { session } = useAuth()
  const provider = getProvider()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const demo = isDemo()

  if (session) return <Navigate to="/dashboard" replace />

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await provider.signIn(email, password)
    setLoading(false)
    if (error) toast({ title: 'Login failed', description: error, variant: 'destructive' })
  }

  const handleDemoLogin = async () => {
    setLoading(true)
    const { error } = await provider.signIn('demo@pawntrack.app', 'demo123')
    setLoading(false)
    if (error) toast({ title: 'Demo login failed', description: error, variant: 'destructive' })
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md space-y-6 border rounded-md p-6">
        <div>
          <h1 className="text-2xl font-semibold">Sign in to PawnTrack</h1>
          <p className="text-sm text-muted-foreground mt-1">Pawnshop management system</p>
        </div>

        {demo && (
          <div className="space-y-3">
            <Button className="w-full" size="lg" onClick={handleDemoLogin} disabled={loading}>
              {loading ? 'Signing in...' : '🔑 Use Demo Account'}
            </Button>
            <div className="text-xs text-muted-foreground text-center space-y-0.5">
              <div>Email: <code className="bg-muted px-1 rounded">demo@pawntrack.app</code></div>
              <div>Password: <code className="bg-muted px-1 rounded">demo123</code></div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">or sign in with credentials</span></div>
            </div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <Input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <Input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          <Button className="w-full" disabled={loading} type="submit">{loading ? 'Signing in...' : 'Sign in'}</Button>
        </form>

        {!demo && (
          <p className="text-sm text-muted-foreground">No account? <Link to="/signup" className="underline">Sign up</Link></p>
        )}

        {demo && (
          <p className="text-xs text-muted-foreground text-center mt-4">
            Demo mode — data is stored locally in your browser. Do not enter real sensitive information.
          </p>
        )}
      </div>
    </div>
  )
}
