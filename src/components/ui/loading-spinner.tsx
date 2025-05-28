import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  text?: string
  className?: string
  fullScreen?: boolean
  variant?: 'spinner' | 'skeleton'
  skeletonRows?: number
}

export function LoadingSpinner({ 
  size = 'md', 
  text = 'Loading...', 
  className = '',
  fullScreen = false,
  variant = 'spinner',
  skeletonRows = 3
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6', 
    lg: 'h-8 w-8',
    xl: 'h-12 w-12'
  }

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-sm', 
    xl: 'text-base'
  }

  const renderSpinner = () => (
    <div className={cn("flex flex-col items-center justify-center", className)}>
      <RefreshCw className={cn(
        sizeClasses[size],
        "text-gray-400 mx-auto mb-2 animate-spin"
      )} />
      {text && (
        <p className={cn("text-gray-600", textSizeClasses[size])}>
          {text}
        </p>
      )}
    </div>
  )

  const renderSkeleton = () => (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: skeletonRows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      ))}
    </div>
  )

  const content = variant === 'skeleton' ? renderSkeleton() : renderSpinner()

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        {content}
      </div>
    )
  }

  return content
}

// Export sub-components for specific use cases
export const LoadingText = ({ text = 'Loading...', size = 'sm' }: { text?: string, size?: 'sm' | 'md' | 'lg' }) => (
  <span className={cn(
    "text-gray-500",
    size === 'sm' && "text-xs",
    size === 'md' && "text-sm", 
    size === 'lg' && "text-base"
  )}>
    {text}
  </span>
)

export const SpinnerIcon = ({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg' | 'xl', className?: string }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6', 
    lg: 'h-8 w-8',
    xl: 'h-12 w-12'
  }
  
  return (
    <RefreshCw className={cn(
      sizeClasses[size],
      "text-gray-400 animate-spin",
      className
    )} />
  )
} 