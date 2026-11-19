import { useEffect, useState } from 'react'
import { getProvider } from '@/data'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { User, Image as ImageIcon } from 'lucide-react'

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

interface StorageImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  path?: string | null
  bucket?: string
  fallbackSrc?: string
}

export function StorageImage({
  path,
  bucket = 'customers',
  fallbackSrc = '/placeholder.svg',
  alt = 'Image',
  className = '',
  ...props
}: StorageImageProps) {
  const { url, loading } = useStorageUrl(path, bucket)
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    setImgError(false)
  }, [path])

  const displaySrc = imgError || !url ? fallbackSrc : url

  return (
    <img
      {...props}
      src={displaySrc}
      alt={alt}
      className={className}
      onError={(e) => {
        setImgError(true)
        if (props.onError) props.onError(e)
      }}
    />
  )
}

interface CustomerAvatarProps {
  photoPath?: string | null
  name?: string
  className?: string
  iconSize?: string
}

export function CustomerAvatar({
  photoPath,
  name,
  className = 'w-10 h-10',
  iconSize = 'w-5 h-5',
}: CustomerAvatarProps) {
  const { url } = useStorageUrl(photoPath, 'customers')

  return (
    <Avatar className={className}>
      {url && url !== '/placeholder.svg' ? (
        <AvatarImage src={url} alt={name || 'Customer'} />
      ) : null}
      <AvatarFallback>
        <User className={iconSize} />
      </AvatarFallback>
    </Avatar>
  )
}
