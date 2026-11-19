import { useEffect, useState } from 'react'
import { getProvider } from '@/data'

interface UseStorageUrlResult {
  url: string | null
  loading: boolean
  error: boolean
}

/**
 * Hook to resolve storage paths / keys (e.g. demo-media:... or Supabase paths)
 * to displayable browser URLs.
 */
export function useStorageUrl(path?: string | null, bucket: string = 'customers'): UseStorageUrlResult {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(Boolean(path))
  const [error, setError] = useState<boolean>(false)

  useEffect(() => {
    let active = true

    if (!path || path === '' || path === '/placeholder.svg') {
      setUrl('/placeholder.svg')
      setLoading(false)
      setError(false)
      return
    }

    setUrl(null)
    setLoading(true)
    const provider = getProvider()

    provider.storage
      .getUrl(bucket, path)
      .then((resolvedUrl) => {
        if (active) {
          setUrl(resolvedUrl || '/placeholder.svg')
          setLoading(false)
          setError(false)
        }
      })
      .catch(() => {
        if (active) {
          setUrl('/placeholder.svg')
          setLoading(false)
          setError(true)
        }
      })

    return () => {
      active = false
    }
  }, [path, bucket])

  return { url, loading, error }
}

