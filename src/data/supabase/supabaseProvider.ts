// Supabase data provider — wraps the existing supabase client calls.
// Conforms to the DataProvider interface for production Supabase mode.

import type { DataProvider } from '../dataProvider'
import type { Customer, Loan, Payment, Due, Notification, LoanAsset, AppSession } from '../types'
import { supabase } from '@/integrations/supabase/client'

export function createSupabaseProvider(): DataProvider {
  const provider: DataProvider = {
    // --- Auth ---
    async getSession(): Promise<AppSession | null> {
      const { data } = await supabase.auth.getSession()
      if (!data.session?.user) return null
      return { user: { id: data.session.user.id, email: data.session.user.email || '' } }
    },

    async signIn(email: string, password: string) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { session: null, error: error.message }
      if (!data.session?.user) return { session: null, error: 'Sign-in failed' }
      return { session: { user: { id: data.session.user.id, email: data.session.user.email || '' } }, error: null }
    },

    async signOut() {
      await supabase.auth.signOut()
    },

    onAuthStateChange(callback: (session: AppSession | null) => void): () => void {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          callback({ user: { id: session.user.id, email: session.user.email || '' } })
        } else {
          callback(null)
        }
      })
      return () => data.subscription.unsubscribe()
    },

    // --- Customers ---
    customers: {
      async list(_orgId: string) {
        const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false })
        if (error) throw error
        return (data || []) as Customer[]
      },
      async get(id: string) {
        const { data, error } = await supabase.from('customers').select('*').eq('id', id).maybeSingle()
        if (error) throw error
        return (data as Customer) || null
      },
      async create(input) {
        const { data, error } = await supabase.from('customers').insert(input as never).select().single()
        if (error) throw error
        return data as Customer
      },
      async update(id, input) {
        const { error } = await supabase.from('customers').update(input as never).eq('id', id)
        if (error) throw error
      },
      async remove(id) {
        const { error } = await supabase.from('customers').delete().eq('id', id)
        if (error) throw error
      },
    },

    // --- Loans ---
    loans: {
      async list(_orgId: string) {
        const { data, error } = await supabase.from('loans').select('*').order('created_at', { ascending: false })
        if (error) throw error
        return (data || []) as Loan[]
      },
      async get(id: string) {
        const { data, error } = await supabase.from('loans').select('*').eq('id', id).maybeSingle()
        if (error) throw error
        return (data as Loan) || null
      },
      async create(input) {
        const { data, error } = await supabase.from('loans').insert(input as never).select().single()
        if (error) throw error
        return data as Loan
      },
      async update(id, input) {
        const { error } = await supabase.from('loans').update(input as never).eq('id', id)
        if (error) throw error
      },
      async remove(id) {
        await supabase.from('loan_assets').delete().eq('loan_id', id)
        const { error } = await supabase.from('loans').delete().eq('id', id)
        if (error) throw error
      },
    },

    // --- Payments ---
    payments: {
      async list(_orgId: string) {
        const { data, error } = await supabase.from('payments').select('*').order('created_at', { ascending: false })
        if (error) throw error
        return (data || []) as Payment[]
      },
      async create(input) {
        const { data: payment, error } = await supabase.from('payments').insert(input as never).select().single()
        if (error) throw error

        // Synchronize principal balance
        if (input.type === 'principal' && input.loan_id) {
          const { data: loan } = await supabase.from('loans').select('remaining_principal, status').eq('id', input.loan_id).maybeSingle()
          if (loan) {
            const newPrincipal = Math.max(0, Number(loan.remaining_principal || 0) - Number(input.amount))
            const updatePayload: Record<string, unknown> = { remaining_principal: newPrincipal }
            if (newPrincipal === 0) {
              updatePayload.status = 'closed'
            }
            await supabase.from('loans').update(updatePayload as never).eq('id', input.loan_id)
          }
        } else if (input.type === 'interest' && input.loan_id) {
          // Settle oldest unpaid due for this loan
          const { data: unpaidDues } = await supabase
            .from('dues')
            .select('id, status, due_date')
            .eq('loan_id', input.loan_id)
            .in('status', ['overdue', 'pending'])
            .order('due_date', { ascending: true })
            .limit(1)

          if (unpaidDues && unpaidDues.length > 0) {
            await supabase.from('dues').update({ status: 'paid' } as never).eq('id', unpaidDues[0].id)
          }
        }

        return payment as Payment
      },
    },

    // --- Dues ---
    dues: {
      async list(_orgId: string) {
        const { data, error } = await supabase.from('dues').select('*')
        if (error) throw error
        return (data || []) as Due[]
      },
      async update(id, input) {
        const { error } = await supabase.from('dues').update(input as never).eq('id', id)
        if (error) throw error
      },
      async create(input) {
        const { data, error } = await supabase.from('dues').insert(input as never).select().single()
        if (error) throw error
        return data as Due
      },
    },

    // --- Notifications ---
    notifications: {
      async list(_orgId: string) {
        const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false })
        if (error) throw error
        return (data || []) as Notification[]
      },
      async create(input) {
        const { data, error } = await supabase.from('notifications').insert(input as never).select().single()
        if (error) throw error
        return data as Notification
      },
    },

    // --- Loan Assets ---
    loanAssets: {
      async list(loanId: string) {
        const { data, error } = await supabase.from('loan_assets').select('*').eq('loan_id', loanId)
        if (error) throw error
        return (data || []) as LoanAsset[]
      },
      async add(input) {
        const { data, error } = await supabase.from('loan_assets').insert(input as never).select().single()
        if (error) throw error
        return data as LoanAsset
      },
      async remove(id) {
        const { error } = await supabase.from('loan_assets').delete().eq('id', id)
        if (error) throw error
      },
    },

    // --- Storage ---
    storage: {
      async upload(bucket, path, file, options) {
        const { error } = await supabase.storage.from(bucket).upload(path, file, {
          upsert: options?.upsert || false,
          contentType: options?.contentType,
        })
        if (error) throw error
        return path
      },
      async getUrl(bucket, path) {
        if (!path || path === '' || path === '/placeholder.svg') return '/placeholder.svg'
        if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) {
          return path
        }
        const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600)
        if (data?.signedUrl) return data.signedUrl
        const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(path)
        return pubData.publicUrl || '/placeholder.svg'
      },
      async remove(bucket, paths) {
        await supabase.storage.from(bucket).remove(paths)
      },
    },

    // --- Org ---
    async getOrgId(userId: string): Promise<string | null> {
      const { data } = await supabase.from('profiles').select('org_id').eq('id', userId).maybeSingle()
      if (data?.org_id) return data.org_id
      // Create org if needed (idempotent RPC)
      await supabase.from('profiles').upsert({ id: userId })
      const { data: rpcOrgId } = await supabase.rpc('create_org_for_current_user', { p_name: 'My Organization' })
      return (rpcOrgId as unknown as string) || null
    },
  }

  return provider
}
