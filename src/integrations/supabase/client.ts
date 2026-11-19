import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'
import { isDemo } from '@/data/dataProvider'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!isDemo() && (!url || !key)) throw Error('Configure the Supabase URL and public key')

export const supabase = createClient<Database>(url || 'https://placeholder.supabase.co',key || 'placeholder_key',{
  auth: { persistSession: !isDemo(), autoRefreshToken: !isDemo(), detectSessionInUrl: !isDemo() },
  global: { fetch: (input,init) => {
    if (!navigator.onLine) return Promise.reject(new Error('Reconnect to access shop records'))
    return fetch(input, { ...init, cache:'no-store' })
  } },
})
