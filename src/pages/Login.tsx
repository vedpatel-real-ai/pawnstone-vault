import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function Login() {
  const { toast } = useToast()
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  if (session) return <Navigate to="/dashboard" replace />

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) toast({ title: 'Login failed', description: error.message, variant: 'destructive' })
    else window.location.href = '/dashboard'
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleLogin} className="w-full max-w-md space-y-4 border rounded-md p-6">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <Input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <Input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        <Button className="w-full" disabled={loading} type="submit">{loading ? 'Signing in...' : 'Sign in'}</Button>
        <p className="text-sm text-muted-foreground">No account? <Link to="/signup" className="underline">Sign up</Link></p>
      </form>
    </div>
  )
}
