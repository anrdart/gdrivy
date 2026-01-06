interface SkeletonLoaderProps {
  variant?: 'text' | 'rectangular' | 'circular'
  width?: string
  height?: string
  className?: string
}

/**
 * SkeletonLoader Component
 * 
 * Skeleton loading placeholder for content that is being loaded.
 * Used for file list and metadata preview.
 * 
 * Requirements: 5.5
 * - THE User_Interface SHALL provide visual feedback for all user actions (loading states, success, errors)
 */
export function SkeletonLoader({ 
  variant = 'rectangular', 
  width = '100%', 
  height = '1rem',
  className = '' 
}: SkeletonLoaderProps) {
  const variantClasses = {
    text: 'rounded',
    rectangular: 'rounded-xl',
    circular: 'rounded-full',
  }

  return (
    <div
      className={`animate-pulse bg-surface-700 ${variantClasses[variant]} ${className}`}
      style={{ width, height }}
      role="status"
      aria-label="Loading..."
    />
  )
}

/**
 * FilePreviewSkeleton Component
 * 
 * Skeleton loader specifically for FilePreview component.
 */
export function FilePreviewSkeleton() {
  return (
    <div className="w-full max-w-2xl mx-auto card animate-pulse">
      <div className="flex items-start gap-4">
        {/* Icon skeleton */}
        <div className="flex-shrink-0 p-4 bg-surface-900 rounded-xl">
          <SkeletonLoader variant="rectangular" width="2rem" height="2rem" />
        </div>

        {/* Content skeleton */}
        <div className="flex-grow">
          {/* File name */}
          <SkeletonLoader variant="text" width="60%" height="1.5rem" className="mb-4" />
          
          {/* File details */}
          <div className="flex gap-3">
            <SkeletonLoader variant="rectangular" width="80px" height="1.5rem" className="rounded-full" />
            <SkeletonLoader variant="rectangular" width="100px" height="1.5rem" className="rounded-full" />
          </div>
        </div>
      </div>

      {/* Download button skeleton */}
      <SkeletonLoader variant="rectangular" width="100%" height="3.5rem" className="mt-5" />
    </div>
  )
}

/**
 * FileListSkeleton Component
 * 
 * Skeleton loader for folder file list.
 */
export function FileListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 p-3 bg-surface-900 rounded-xl">
          <SkeletonLoader variant="circular" width="2rem" height="2rem" />
          <div className="flex-grow">
            <SkeletonLoader variant="text" width="70%" height="1rem" className="mb-2" />
            <SkeletonLoader variant="text" width="40%" height="0.75rem" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default SkeletonLoader
