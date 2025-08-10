import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function Signup() {
  const { toast } = useToast()
  const { session } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  if (session) return <Navigate to="/dashboard" replace />

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setLoading(false)
      toast({ title: 'Signup failed', description: error.message, variant: 'destructive' })
      return
    }
    // Create profile with first org (handled in useAuth too, but try here optimistically)
    if (data?.user) {
      const { data: org } = await supabase.from('organizations').select('id').limit(1).single()
      if (org?.id) await supabase.from('profiles').upsert({ id: data.user.id, org_id: org.id, full_name: fullName })
    }
    setLoading(false)
    toast({ title: 'Account created', description: 'You can now sign in.' })
    window.location.href = '/login'
  }

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
