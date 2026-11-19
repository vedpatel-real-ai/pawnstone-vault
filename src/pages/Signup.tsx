import { supabase } from '@/integrations/supabase/client'
import { useState } from 'react'
import { isDemo } from '@/data/dataProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function Signup() {
  const { session } = useAuth()
  const demo = isDemo()

  if (session) return <Navigate to="/dashboard" replace />

  if (demo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md space-y-4 border rounded-md p-6">
          <h1 className="text-2xl font-semibold">Create account</h1>
          <p className="text-sm text-muted-foreground">
            Account creation is not available in the public demo. Please use the demo account to explore PawnTrack.
          </p>
          <Link to="/login">
            <Button className="w-full">Go to Demo Login</Button>
          </Link>
        </div>
      </div>
    )
  }

  return <SupabaseSignup />
}

function SupabaseSignup() {
  const { toast } = useToast()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
      if (error) {
        setLoading(false)
        toast({ title: 'Signup failed', description: error.message, variant: 'destructive' })
        return
      }
      setLoading(false)
      if (!data.session) setAwaitingConfirmation(true)
    } catch (err: unknown) {
      setLoading(false)
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast({ title: 'Signup failed', description: msg, variant: 'destructive' })
    }
  }

  if (awaitingConfirmation) return (
    <main className="container max-w-md py-12 space-y-4">
      <h1 className="text-2xl font-semibold">Check your email</h1>
      <p>Follow the confirmation link sent to your address, then sign in to open your shop.</p>
      <Link to="/login" className="underline">Go to sign in</Link>
    </main>
  )

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSignup} className="w-full max-w-md space-y-4 border rounded-md p-6">
        <h1 className="text-2xl font-semibold">Create account</h1>
        <Input placeholder="Full name" value={fullName} onChange={e => setFullName(e.target.value)} required />
        <Input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <Input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        <Button className="w-full" disabled={loading} type="submit">{loading ? 'Creating...' : 'Sign up'}</Button>
        <p className="text-sm text-muted-foreground">Have an account? <Link to="/login" className="underline">Sign in</Link></p>
      </form>
    </div>
  )
}
