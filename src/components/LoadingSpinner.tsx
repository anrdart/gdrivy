import { FiLoader } from 'react-icons/fi'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  className?: string
}

/**
 * LoadingSpinner Component
 * 
 * Reusable loading spinner with optional text.
 * Used for metadata fetch and other async operations.
 * 
 * Requirements: 5.5
 * - THE User_Interface SHALL provide visual feedback for all user actions (loading states, success, errors)
 */
export function LoadingSpinner({ size = 'md', text, className = '' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  }

  return (
    <div className={`flex items-center justify-center gap-3 ${className}`} role="status" aria-live="polite">
      <FiLoader className={`animate-spin text-primary-400 ${sizeClasses[size]}`} />
      {text && <span className="text-gray-400 font-medium">{text}</span>}
      <span className="sr-only">{text || 'Loading...'}</span>
    </div>
  )
}

export default LoadingSpinner
