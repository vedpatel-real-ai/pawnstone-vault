import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Upload, X, Image, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AssetImageUploadProps {
  loanId: string
  images: Array<{ id: string; url: string; name: string }>
  onImagesChange: (images: Array<{ id: string; url: string; name: string }>) => void
  maxImages?: number
  disabled?: boolean
}

export function AssetImageUpload({ 
  loanId, 
  images, 
  onImagesChange, 
  maxImages = 10,
  disabled = false 
}: AssetImageUploadProps) {
  const { toast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [previews, setPreviews] = useState<Array<{ file: File; preview: string }>>([])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (images.length + acceptedFiles.length > maxImages) {
      toast({
        title: 'Too many images',
        description: `Maximum ${maxImages} images allowed`,
        variant: 'destructive'
      })
      return
    }

    // Validate files
    const validFiles = acceptedFiles.filter(file => {
      if (!file.type.match(/^image\/(jpeg|jpg|png)$/)) {
        toast({
          title: 'Invalid file type',
          description: `${file.name} is not a JPEG or PNG image`,
          variant: 'destructive'
        })
        return false
      }
      if (file.size > 3 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: `${file.name} is larger than 3MB`,
          variant: 'destructive'
        })
        return false
      }
      return true
    })

    // Create previews
    const newPreviews = validFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }))
    
    setPreviews(prev => [...prev, ...newPreviews])
  }, [images.length, maxImages, toast])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png'] },
    disabled: disabled || uploading
  })

  const uploadImages = async () => {
    if (previews.length === 0) return

    setUploading(true)
    const uploadedImages = []

    try {
      for (const preview of previews) {
        const fileExt = preview.file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `${loanId}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('loan_assets')
          .upload(filePath, preview.file)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('loan_assets')
          .getPublicUrl(filePath)

        // Save to loan_assets table
        const { error: dbError } = await supabase
          .from('loan_assets')
          .insert({
            loan_id: loanId,
            file_url: publicUrl,
            file_name: preview.file.name,
            file_size: preview.file.size
          })

        if (dbError) throw dbError

        uploadedImages.push({
          id: `${Date.now()}-${Math.random()}`,
          url: publicUrl,
          name: preview.file.name
        })
      }

      onImagesChange([...images, ...uploadedImages])
      setPreviews([])
      
      toast({
        title: 'Images uploaded',
        description: `${uploadedImages.length} images uploaded successfully`
      })
    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: 'Upload failed',
        description: 'Failed to upload some images. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setUploading(false)
    }
  }

  const removePreview = (index: number) => {
    setPreviews(prev => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  const removeImage = async (imageId: string, imageUrl: string) => {
    try {
      // Extract file path from URL
      const urlParts = imageUrl.split('/loan_assets/')
      if (urlParts.length > 1) {
        const filePath = urlParts[1]
        
        // Delete from storage
        await supabase.storage
          .from('loan_assets')
          .remove([filePath])
      }

      // Remove from database
      await supabase
        .from('loan_assets')
        .delete()
        .eq('loan_id', loanId)
        .eq('file_url', imageUrl)

      onImagesChange(images.filter(img => img.id !== imageId))
      
      toast({
        title: 'Image removed',
        description: 'Image deleted successfully'
      })
    } catch (error) {
      console.error('Delete error:', error)
      toast({
        title: 'Delete failed',
        description: 'Failed to delete image',
        variant: 'destructive'
      })
    }
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25",
          disabled || uploading ? "opacity-50 cursor-not-allowed" : "hover:border-primary hover:bg-primary/5"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
        {isDragActive ? (
          <p>Drop the images here...</p>
        ) : (
          <div>
            <p className="font-medium">Click to upload or drag and drop</p>
            <p className="text-sm text-muted-foreground">JPEG, PNG up to 3MB each</p>
          </div>
        )}
      </div>

      {/* Preview Images */}
      {previews.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Ready to upload:</h4>
            <Button onClick={uploadImages} disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                `Upload ${previews.length} images`
              )}
            </Button>
          </div>
          
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
            {previews.map((preview, index) => (
              <div key={index} className="relative group">
                <img
                  src={preview.preview}
                  alt="Preview"
                  className="w-full h-24 object-cover rounded-lg"
                />
                <Button
                  size="sm"
                  variant="destructive"
                  className="absolute top-1 right-1 w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removePreview(index)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Uploaded Images */}
      {images.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium">Asset Images ({images.length}):</h4>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
            {images.map((image) => (
              <div key={image.id} className="relative group">
                <img
                  src={image.url}
                  alt={image.name}
                  className="w-full h-24 object-cover rounded-lg"
                />
                <Button
                  size="sm"
                  variant="destructive"
                  className="absolute top-1 right-1 w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeImage(image.id, image.url)}
                  disabled={disabled}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {images.length === 0 && previews.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Image className="w-4 h-4" />
          At least one asset image is required
        </div>
      )}
    </div>
  )
}