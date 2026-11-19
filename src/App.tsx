import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import Loans from "./pages/Loans";
import Payments from "./pages/Payments";
import Notifications from "./pages/Notifications";
import Reports from "./pages/Reports";
import AssetInventory from "./pages/AssetInventory";
import AppLayout from "./components/layout/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";

import { isDemo } from './data/dataProvider'
import { useSyncExternalStore } from 'react'
import { AuthProvider } from './components/AuthProvider'

const queryClient = new QueryClient({ defaultOptions: {
  queries: { networkMode: 'always' }, mutations: { networkMode: 'always', retry: false },
} })
function subscribe(listener: () => void) {
  window.addEventListener('online',listener)
  window.addEventListener('offline',listener)
  return () => {
    window.removeEventListener('online',listener)
    window.removeEventListener('offline',listener)
  }
}
function ConnectionBoundary({children}: React.PropsWithChildren) {
  const online = useSyncExternalStore(subscribe,() => navigator.onLine)
  if (!online && !isDemo()) return <main role="status" className="container py-12">Offline. Reconnect to view shop records or record a collection.</main>
  return children
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ConnectionBoundary><AuthProvider><TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Index />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Dashboard />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Customers />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/loans"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Loans />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/payments"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Payments />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Reports />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Notifications />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/assets"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <AssetInventory />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider></AuthProvider></ConnectionBoundary>
  </QueryClientProvider>
);

export default App;

