import { attachCollateral } from '@/data/attachCollateral'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getProvider } from '@/data'
import { useAuth } from '@/hooks/useAuth'
import { StorageImage } from '@/components/StorageImage'

export interface AssetUploadItem {
  id: string
  url: string
  name: string
  file?: File
}

interface AssetImageUploadProps {
  loanId: string
  images: AssetUploadItem[]
  onImagesChange: (images: AssetUploadItem[]) => void
  maxImages?: number
  disabled?: boolean
}

export function AssetImageUpload({
  loanId,
  images,
  onImagesChange,
  maxImages = 10,
  disabled = false,
}: AssetImageUploadProps) {
  const { toast } = useToast()
  const { orgId } = useAuth()
  const provider = getProvider()
  const [uploading, setUploading] = useState(false)

  const previews = useRef(new Set<string>())
  useEffect(() => {
    const active = new Set(images.filter(item => item.file).map(item => item.url))
    for (const url of previews.current) if (!active.has(url)) URL.revokeObjectURL(url)
    previews.current = active
  },[images])
  useEffect(() => () => { for (const url of previews.current) URL.revokeObjectURL(url) },[])
  const isNewLoan = !loanId || loanId === 'temp'

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (images.length + acceptedFiles.length > maxImages) {
        toast({
          title: 'Too many images',
          description: `Maximum ${maxImages} images allowed`,
          variant: 'destructive',
        })
        return
      }

      // Validate files
      const validFiles = acceptedFiles.filter(file => {
        if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/)) {
          toast({
            title: 'Invalid file type',
            description: `${file.name} is not a JPEG, PNG, or WebP image`,
            variant: 'destructive',
          })
          return false
        }
        if (file.size > 5 * 1024 * 1024) {
          toast({
            title: 'File too large',
            description: `${file.name} exceeds 5MB limit`,
            variant: 'destructive',
          })
          return false
        }
        return true
      })

      if (validFiles.length === 0) return

      if (isNewLoan) {
        // Client-side staging: retain File objects & preview URLs without creating invalid temp bucket paths
        const newItems: AssetUploadItem[] = validFiles.map(file => ({
          id: `staged-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          url: URL.createObjectURL(file),
          name: file.name,
          file,
        }))
        onImagesChange([...images, ...newItems])
      } else {
        // Existing loan: upload directly under loanId
        setUploading(true)
        try {
          const uploadedItems: AssetUploadItem[] = []
          for (const file of validFiles) {
            if (!orgId) throw Error('Organization unavailable')
            const asset = await attachCollateral(provider,orgId,loanId,file)
            uploadedItems.push({id:asset.id,url:asset.file_url,name:asset.file_name})
            onImagesChange([...images,...uploadedItems])
          }

          toast({
            title: 'Images uploaded',
            description: `${uploadedItems.length} image(s) attached successfully`,
          })
        } catch (error: unknown) {
          console.error('Upload error:', error)
          const msg = error instanceof Error ? error.message : 'Failed to upload images. Please try again.'
          toast({
            title: 'Upload failed',
            description: msg,
            variant: 'destructive',
          })
        } finally {
          setUploading(false)
        }
      }
    },
    [images, isNewLoan, loanId, maxImages, onImagesChange, orgId, provider, toast]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    disabled: disabled || uploading,
  })

  const removeImage = async (item: AssetUploadItem) => {
    try {
      // If it was a staged blob URL, revoke it
      if (item.file && item.url.startsWith('blob:')) {
        URL.revokeObjectURL(item.url)
      } else if (!isNewLoan && orgId) {
        await provider.storage.remove('loan_assets', [item.url])
        await provider.loanAssets.remove(item.id)
      }

      onImagesChange(images.filter(img => img.id !== item.id))
      toast({
        title: 'Image removed',
        description: `${item.name} removed`,
      })
    } catch (error: unknown) {
      console.error('Delete error:', error)
      toast({
        title: 'Delete failed',
        description: 'Failed to delete image',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-4">
      {/* Upload Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
          isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
          disabled || uploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary hover:bg-primary/5'
        )}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div className="flex flex-col items-center">
            <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-primary" />
            <p className="font-medium">Uploading images...</p>
          </div>
        ) : (
          <div>
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="font-medium">Click to upload collateral photos or drag and drop</p>
            <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, WebP up to 5MB each (Max {maxImages})</p>
          </div>
        )}
      </div>

      {/* Uploaded / Staged Images Grid */}
      {images.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Pledged Asset Photos ({images.length})</h4>
            {isNewLoan && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                Staged for save
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {images.map((img) => (
              <div key={img.id} className="relative group border rounded-lg overflow-hidden bg-muted/30">
                {img.file && img.url.startsWith('blob:') ? (
                  <img
                    src={img.url}
                    alt={img.name}
                    className="w-full h-24 object-cover"
                  />
                ) : (
                  <StorageImage
                    bucket="loan_assets"
                    path={img.url}
                    alt={img.name}
                    className="w-full h-24 object-cover"
                  />
                )}
                <div className="p-1.5 bg-background/90 text-xs truncate border-t font-mono">
                  {img.name}
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  className="absolute top-1 right-1 w-6 h-6 p-0 opacity-80 hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeImage(img)
                  }}
                  disabled={disabled || uploading}
                  title="Remove image"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {images.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ImageIcon className="w-4 h-4" />
          Collateral verification photos are recommended for vault records
        </div>
      )}
    </div>
  )
}