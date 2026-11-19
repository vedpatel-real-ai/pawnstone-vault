import { useEffect, useState } from 'react'
import { useStorageUrl } from '@/hooks/useStorageUrl'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { User, Image as ImageIcon } from 'lucide-react'

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
