// Supabase data provider — wraps the existing supabase client calls.
// Conforms to the DataProvider interface for production Supabase mode.

import type { DataProvider } from '../dataProvider'
import type { AppSession } from '../types'
import { supabase } from '@/integrations/supabase/client'

async function readPages<T>(page: (from:number,to:number) => PromiseLike<{
  data:T[] | null; error:{message:string} | null
}>) {
  const result:T[] = []
  for (let from=0; ; from+=500) {
    const { data,error } = await page(from,from+499)
    if (error) throw Error(error.message)
    result.push(...(data ?? []))
    if (!data || data.length < 500) return result
  }
}

export function createSupabaseProvider(): DataProvider {
  const provider: DataProvider = {
    // --- Auth ---
    async getSession(): Promise<AppSession | null> {
      const { data,error } = await supabase.auth.getSession()
      if (error) throw Error(error.message)
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
      const { error } = await supabase.auth.signOut()
      if (error) throw new Error(error.message)
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
      async list(orgId) {
        return readPages((from,to) => supabase.from('customers').select('*').eq('org_id',orgId)
          .order('created_at', {ascending:false}).order('id').range(from,to))
      },
      async get(id: string) {
        const { data, error } = await supabase.from('customers').select('*').eq('id', id).maybeSingle()
        if (error) throw new Error(error.message)
        return data
      },
      async create(input) {
        const { data, error } = await supabase.from('customers').insert(input).select().single()
        if (error) throw new Error(error.message)
        return data
      },
      async update(id, input) {
        const { error } = await supabase.from('customers').update(input).eq('id', id).select('id').single()
        if (error) throw new Error(error.message)
      },
      async remove(id) {
        const { error } = await supabase.from('customers').delete().eq('id', id).select('id').single()
        if (error) throw new Error(error.message)
      },
    },

    // --- Loans ---
    loans: {
      async list(orgId) {
        return readPages((from,to) => supabase.from('loans').select('*').eq('org_id',orgId)
          .order('created_at', {ascending:false}).order('id').range(from,to))
      },
      async get(id: string) {
        const { data, error } = await supabase.from('loans').select('*').eq('id', id).maybeSingle()
        if (error) throw new Error(error.message)
        return data
      },
      async create(input) {
        const { data, error } = await supabase.from('loans').insert(input).select().single()
        if (error) throw new Error(error.message)
        return data
      },
      async update(id, input) {
        const { error } = await supabase.from('loans').update(input).eq('id', id).select('id').single()
        if (error) throw new Error(error.message)
      },
      async remove() {
        throw Error('Loan history is retained')
      },
    },

    // --- Payments ---
    payments: {
      async list(orgId) {
        return readPages((from,to) => supabase.from('payments').select('*').eq('org_id',orgId)
          .order('created_at', {ascending:false}).order('id').range(from,to))
      },
      async create(input) {
        const { data, error } = await supabase.rpc('post_payment', {
          p_request:input.request_id, p_loan:input.loan_id, p_amount:input.amount, p_type:input.type, p_notes:input.notes,
        })
        if (error) throw Error(error.message)
        return data
      },
    },

    // --- Dues ---
    dues: {
      async list(orgId) {
        return readPages((from,to) => supabase.from('dues').select('*').eq('org_id',orgId)
          .order('created_at', {ascending:false}).order('id').range(from,to))
      },
    },

    // --- Notifications ---
    notifications: {
      async list(orgId) {
        return readPages((from,to) => supabase.from('notifications').select('*').eq('org_id',orgId)
          .order('created_at', {ascending:false}).order('id').range(from,to))
      },
      async create(input) {
        const { data, error } = await supabase.from('notifications').insert(input).select().single()
        if (error) throw new Error(error.message)
        return data
      },
    },

    // --- Loan Assets ---
    loanAssets: {
      async list(loanId: string) {
        const { data, error } = await supabase.from('loan_assets').select('*').eq('loan_id', loanId)
        if (error) throw new Error(error.message)
        return (data || [])
      },
      async add(input) {
        const { data, error } = await supabase.from('loan_assets').insert(input).select().single()
        if (error) throw new Error(error.message)
        return data
      },
      async remove(id) {
        const { error } = await supabase.from('loan_assets').delete().eq('id', id).select('id').single()
        if (error) throw new Error(error.message)
      },
    },

    // --- Storage ---
    storage: {
      async upload(bucket, path, file, options) {
        const { error } = await supabase.storage.from(bucket).upload(path, file, {
          upsert: options?.upsert || false,
          contentType: options?.contentType,
        })
        if (error) throw new Error(error.message)
        return path
      },
      async getUrl(bucket, path) {
        if (!path || path === '' || path === '/placeholder.svg') return '/placeholder.svg'
        if (/^[a-z]+:/i.test(path)) return '/placeholder.svg'
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300)
        return error ? '/placeholder.svg' : data.signedUrl
      },
      async remove(bucket, paths) {
        const { error } = await supabase.storage.from(bucket).remove(paths)
        if (error) throw new Error(error.message)
      },
    },

    // --- Org ---
    async getOrgId(): Promise<string | null> {
      const { data, error } = await supabase.rpc('create_org_for_current_user', { p_name: 'My Organization' })
      if (error) throw new Error(error.message)
      return data
    },
  }

  return provider
}
