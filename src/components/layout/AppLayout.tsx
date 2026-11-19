import { Link, useLocation } from 'react-router-dom'
import { PropsWithChildren, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { getProvider } from '@/data'
import { useQueryClient } from '@tanstack/react-query'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export default function AppLayout({ children }: PropsWithChildren) {
  const location = useLocation()
  const { isDemo } = useAuth()
  const provider = getProvider()
  const qc = useQueryClient()
  const [showReset, setShowReset] = useState(false)

  const nav = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/customers', label: 'Customers' },
    { to: '/loans', label: 'Loans' },
    { to: '/payments', label: 'Payments' },
    { to: '/reports', label: 'Reports' },
    { to: '/assets', label: 'Assets' },
    { to: '/notifications', label: 'Notifications' },
  ]

  const handleSignOut = async () => {
    await provider.signOut()
    qc.clear()
  }

  const handleResetDemo = async () => {
    if (provider.resetDemoData) {
      await provider.resetDemoData()
      qc.clear()
      window.location.href = '/dashboard'
    }
    setShowReset(false)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="container flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="font-semibold">PawnTrack</Link>
            {isDemo && (
              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                Demo Mode — data stays in this browser
              </span>
            )}
          </div>
          <nav className="flex max-w-full flex-wrap items-center gap-3">
            {nav.map(n => (
              <Link key={n.to} to={n.to} className={location.pathname.startsWith(n.to) ? 'text-primary' : 'text-muted-foreground'}>{n.label}</Link>
            ))}
            {isDemo && (
              <Button variant="outline" size="sm" onClick={() => setShowReset(true)}>Reset Demo</Button>
            )}
            <Button variant="secondary" onClick={handleSignOut}>Sign out</Button>
          </nav>
        </div>
      </header>
      <main className="container py-6">
        {children}
      </main>

      {/* Reset Demo Data Confirmation */}
      <AlertDialog open={showReset} onOpenChange={setShowReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Demo Data</AlertDialogTitle>
            <AlertDialogDescription>
              This will erase all local demo data (customers, loans, payments, uploads) and restore the original sample dataset.
              <br /><br />
              Your demo session will remain active. Only browser-local demo information will be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetDemo}>Reset Demo Data</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
