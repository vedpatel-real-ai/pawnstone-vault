import localforage from 'localforage'
import { supabase } from '@/integrations/supabase/client'

export type Operation = {
  id: string
  type: 'create_customer' | 'update_customer' | 'delete_customer' |
        'create_loan' | 'update_loan' | 'delete_loan' |
        'create_payment'
  payload: any
}

const STORE_KEY = 'pawntrack-offline-ops'

async function getQueue(): Promise<Operation[]> {
  return (await localforage.getItem<Operation[]>(STORE_KEY)) || []
}

async function setQueue(ops: Operation[]) {
  await localforage.setItem(STORE_KEY, ops)
}

export async function enqueue(op: Operation) {
  const ops = await getQueue()
  await setQueue([...ops, op])
}

async function applyOperation(op: Operation) {
  switch (op.type) {
    case 'create_customer':
      return supabase.from('customers').insert(op.payload)
    case 'update_customer':
      return supabase.from('customers').update(op.payload.values).eq('id', op.payload.id)
    case 'delete_customer':
      return supabase.from('customers').delete().eq('id', op.payload.id)
    case 'create_loan':
      return supabase.from('loans').insert(op.payload)
    case 'update_loan':
      return supabase.from('loans').update(op.payload.values).eq('id', op.payload.id)
    case 'delete_loan':
      return supabase.from('loans').delete().eq('id', op.payload.id)
    case 'create_payment':
      return supabase.from('payments').insert(op.payload)
  }
}

export async function processQueue() {
  const ops = await getQueue()
  const remaining: Operation[] = []
  for (const op of ops) {
    try {
      const { error } = await applyOperation(op)
      if (error) {
        console.warn('Operation failed, keeping in queue', op, error)
        remaining.push(op)
      }
    } catch (e) {
      console.warn('Operation exception, keeping in queue', op, e)
      remaining.push(op)
    }
  }
  await setQueue(remaining)
}

export function initOfflineQueue() {
  window.addEventListener('online', () => {
    processQueue()
  })
}
