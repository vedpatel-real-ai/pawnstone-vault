import localforage from 'localforage'
import { getProvider } from '@/data'
import type { Customer, Loan, Payment } from '@/data/types'

export type Operation =
  | { id: string; type: 'create_customer'; payload: Omit<Customer, 'id' | 'created_at'> }
  | { id: string; type: 'update_customer'; payload: { id: string; values: Partial<Customer> } }
  | { id: string; type: 'delete_customer'; payload: { id: string } }
  | { id: string; type: 'create_loan'; payload: Omit<Loan, 'id' | 'created_at' | 'updated_at'> }
  | { id: string; type: 'update_loan'; payload: { id: string; values: Partial<Loan> } }
  | { id: string; type: 'delete_loan'; payload: { id: string } }
  | { id: string; type: 'create_payment'; payload: Omit<Payment, 'id' | 'created_at'> }

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
  const provider = getProvider()
  switch (op.type) {
    case 'create_customer':
      return provider.customers.create(op.payload)
    case 'update_customer':
      return provider.customers.update(op.payload.id, op.payload.values)
    case 'delete_customer':
      return provider.customers.remove(op.payload.id)
    case 'create_loan':
      return provider.loans.create(op.payload)
    case 'update_loan':
      return provider.loans.update(op.payload.id, op.payload.values)
    case 'delete_loan':
      return provider.loans.remove(op.payload.id)
    case 'create_payment':
      return provider.payments.create(op.payload)
  }
}

export async function processQueue() {
  const ops = await getQueue()
  const remaining: Operation[] = []
  for (const op of ops) {
    try {
      await applyOperation(op)
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
