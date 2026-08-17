// Provider factory and React context.
// Creates the appropriate DataProvider based on VITE_DATA_MODE.

import { createContext, useContext } from 'react'
import type { DataProvider } from './dataProvider'
import { isDemo } from './dataProvider'
import { createDemoProvider } from './demo/demoProvider'
import { createSupabaseProvider } from './supabase/supabaseProvider'

let _provider: DataProvider | null = null

export function getProvider(): DataProvider {
  if (!_provider) {
    _provider = isDemo() ? createDemoProvider() : createSupabaseProvider()
  }
  return _provider
}

export const DataProviderContext = createContext<DataProvider>(getProvider())

export function useDataProvider(): DataProvider {
  return useContext(DataProviderContext)
}
