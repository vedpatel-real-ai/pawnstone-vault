import { createContext, useContext } from 'react'
import type { AppSession } from '@/data/types'

export const AuthContext = createContext<{session:AppSession | null; orgId:string | null; loading:boolean; isDemo:boolean}>({
  session:null,orgId:null,loading:true,isDemo:false,
})
export const useAuth = () => useContext(AuthContext)
