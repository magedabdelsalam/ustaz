/**
 * loading-spinner
 * ----------------
 * TODO: Add description and exports for loading-spinner.
 */

import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LoadingSpinnerProps } from '@/types'

export function LoadingSpinner({ 
  size = 'md', 
  message, 
  className = '',
  fullWidth = false,
  padding,
  fullScreen = false,
  text
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

  const containerClasses = cn(
    "flex flex-col items-center justify-center",
    fullWidth && "w-full",
    fullScreen && "fixed inset-0 bg-white/80 backdrop-blur-sm z-50",
    padding,
    className
  )

  return (
    <div className={containerClasses}>
      <RefreshCw className={cn(
        sizeClasses[size],
        "text-gray-400 mx-auto mb-2 animate-spin"
      )} />
      {(message || text) && (
        <p className={cn("text-gray-600", textSizeClasses[size])}>
          {message || text}
        </p>
      )}
    </div>
  )
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