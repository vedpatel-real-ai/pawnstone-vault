import { Link, useLocation } from 'react-router-dom'
import { PropsWithChildren } from 'react'
import { Button } from '@/components/ui/button'

export default function AppLayout({ children }: PropsWithChildren) {
  const location = useLocation()
  const nav = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/customers', label: 'Customers' },
    { to: '/loans', label: 'Loans' },
    { to: '/payments', label: 'Payments' },
    { to: '/reports', label: 'Reports' },
    { to: '/notifications', label: 'Notifications' },
  ]
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="container flex items-center justify-between h-16">
          <Link to="/dashboard" className="font-semibold">PawnTrack</Link>
          <nav className="flex items-center gap-4">
            {nav.map(n => (
              <Link key={n.to} to={n.to} className={location.pathname.startsWith(n.to) ? 'text-primary' : 'text-muted-foreground'}>{n.label}</Link>
            ))}
            <Button variant="secondary" onClick={async () => { await (await import('@/integrations/supabase/client')).supabase.auth.signOut(); window.location.href = '/login' }}>Sign out</Button>
          </nav>
        </div>
      </header>
      <main className="container py-6">
        {children}
      </main>
    </div>
  )
}
