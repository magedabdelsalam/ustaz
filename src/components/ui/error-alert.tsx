'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, WifiOff, RefreshCw, X, CheckCircle, Info } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AppError, networkMonitor } from '@/lib/errorHandler'
import { cn } from '@/lib/utils'

interface ErrorAlertProps {
  error: AppError | null
  onRetry?: () => void
  onDismiss?: () => void
  showNetworkStatus?: boolean
  className?: string
}

export function ErrorAlert({ 
  error, 
  onRetry, 
  onDismiss, 
  showNetworkStatus = true,
  className 
}: ErrorAlertProps) {
  const [isOnline, setIsOnline] = useState(true)
  const [isRetrying, setIsRetrying] = useState(false)

  useEffect(() => {
    const unsubscribe = networkMonitor.subscribe(setIsOnline)
    return unsubscribe
  }, [])

  if (!error && (!showNetworkStatus || isOnline)) {
    return null
  }

  const handleRetry = async () => {
    if (!onRetry || isRetrying) return
    
    setIsRetrying(true)
    try {
      await onRetry()
    } finally {
      setIsRetrying(false)
    }
  }

  // Show offline message if offline (even without error)
  if (!isOnline && showNetworkStatus) {
    return (
      <Alert className={cn("border-yellow-200 bg-yellow-50", className)}>
        <WifiOff className="h-4 w-4 text-yellow-600" />
        <AlertTitle className="text-yellow-900">Connection Issue</AlertTitle>
        <AlertDescription className="text-yellow-800">
          You&apos;re currently offline. Some features may not work until you reconnect.
        </AlertDescription>
      </Alert>
    )
  }

  if (!error) return null

  const getAlertProps = () => {
    switch (error.type) {
      case 'network':
        return {
          variant: 'default' as const,
          className: "border-yellow-200 bg-yellow-50",
          icon: <WifiOff className="h-4 w-4 text-yellow-600" />,
          title: "Connection Problem",
          titleClass: "text-yellow-900",
          descClass: "text-yellow-800",
          badgeVariant: "secondary" as const,
          badgeClass: "bg-yellow-100 text-yellow-800 border-yellow-200"
        }
      case 'database':
        return {
          variant: 'default' as const,
          className: "border-orange-200 bg-orange-50",
          icon: <AlertTriangle className="h-4 w-4 text-orange-600" />,
          title: "Database Error",
          titleClass: "text-orange-900",
          descClass: "text-orange-800",
          badgeVariant: "secondary" as const,
          badgeClass: "bg-orange-100 text-orange-800 border-orange-200"
        }
      case 'permission':
        return {
          variant: 'destructive' as const,
          className: "",
          icon: <AlertTriangle className="h-4 w-4" />,
          title: "Permission Denied",
          titleClass: "",
          descClass: "",
          badgeVariant: "destructive" as const,
          badgeClass: ""
        }
      case 'validation':
        return {
          variant: 'default' as const,
          className: "border-blue-200 bg-blue-50",
          icon: <Info className="h-4 w-4 text-blue-600" />,
          title: "Invalid Input",
          titleClass: "text-blue-900",
          descClass: "text-blue-800",
          badgeVariant: "secondary" as const,
          badgeClass: "bg-blue-100 text-blue-800 border-blue-200"
        }
      default:
        return {
          variant: 'default' as const,
          className: "border-gray-200 bg-gray-50",
          icon: <AlertTriangle className="h-4 w-4 text-gray-600" />,
          title: "Something Went Wrong",
          titleClass: "text-gray-900",
          descClass: "text-gray-800",
          badgeVariant: "secondary" as const,
          badgeClass: "bg-gray-100 text-gray-800 border-gray-200"
        }
    }
  }

  const alertProps = getAlertProps()

  return (
    <Alert 
      variant={alertProps.variant} 
      className={cn(alertProps.className, "border shadow-sm", className)}
    >
      {alertProps.icon}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <AlertTitle className={cn("text-sm font-medium", alertProps.titleClass)}>
            {alertProps.title}
          </AlertTitle>
          {error.operation && (
            <Badge 
              variant={alertProps.badgeVariant}
              className={cn("text-xs", alertProps.badgeClass)}
            >
              {error.operation.replace(/_/g, ' ')}
            </Badge>
          )}
        </div>
        
        <AlertDescription className={cn("text-sm mb-3", alertProps.descClass)}>
          {error.userMessage}
        </AlertDescription>

        {!isOnline && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
            <WifiOff className="h-3 w-3" />
            Currently offline
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {error.canRetry && onRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRetry}
                disabled={isRetrying}
                className="h-8 px-3 text-xs"
              >
                <RefreshCw className={cn("h-3 w-3 mr-1", isRetrying && "animate-spin")} />
                {isRetrying ? 'Retrying...' : 'Retry'}
              </Button>
            )}
          </div>
          
          {onDismiss && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onDismiss}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
              <span className="sr-only">Dismiss</span>
            </Button>
          )}
        </div>
      </div>
    </Alert>
  )
}

// Success alert for positive feedback
interface SuccessAlertProps {
  message: string
  onDismiss?: () => void
  className?: string
}

export function SuccessAlert({ message, onDismiss, className }: SuccessAlertProps) {
  return (
    <Alert className={cn("border-green-200 bg-green-50 border shadow-sm", className)}>
      <CheckCircle className="h-4 w-4 text-green-600" />
      <div className="flex-1">
        <AlertTitle className="text-sm font-medium text-green-900">Success</AlertTitle>
        <AlertDescription className="text-sm text-green-800 mt-1">
          {message}
        </AlertDescription>
        {onDismiss && (
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={onDismiss}
              className="h-8 w-8 p-0 text-green-700 hover:text-green-900 hover:bg-green-100"
            >
              <X className="h-3 w-3" />
              <span className="sr-only">Dismiss</span>
            </Button>
          </div>
        )}
      </div>
    </Alert>
  )
}

// Network status indicator component
interface NetworkStatusProps {
  className?: string
  showLabel?: boolean
}

export function NetworkStatus({ className, showLabel = true }: NetworkStatusProps) {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    const unsubscribe = networkMonitor.subscribe(setIsOnline)
    return unsubscribe
  }, [])

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {isOnline ? (
        <>
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          {showLabel && <span className="text-sm font-medium text-green-600">Online</span>}
        </>
      ) : (
        <>
          <div className="h-2 w-2 rounded-full bg-red-500" />
          {showLabel && <span className="text-sm font-medium text-red-600">Offline</span>}
        </>
      )}
    </div>
  )
}

// Compact network status badge
export function NetworkStatusBadge({ className }: { className?: string }) {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    const unsubscribe = networkMonitor.subscribe(setIsOnline)
    return unsubscribe
  }, [])

  return (
    <Badge 
      variant={isOnline ? "default" : "destructive"}
      className={cn(
        "text-xs font-medium",
        isOnline 
          ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-100" 
          : "bg-red-100 text-red-700 border-red-200 hover:bg-red-100",
        className
      )}
    >
      <div className={cn(
        "w-1.5 h-1.5 rounded-full mr-1.5",
        isOnline ? "bg-green-500 animate-pulse" : "bg-red-500"
      )} />
      {isOnline ? 'Online' : 'Offline'}
    </Badge>
  )
}

// Toast-style error notification with ShadCN styling
interface ErrorToastProps {
  error: AppError
  onRetry?: () => void
  onDismiss: () => void
  duration?: number
}

export function ErrorToast({ error, onRetry, onDismiss, duration = 6000 }: ErrorToastProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    if (!error.canRetry) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        setTimeout(onDismiss, 300) // Allow for fade out animation
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [error.canRetry, duration, onDismiss])

  if (!isVisible) return null

  return (
    <div className={cn(
      "w-96 max-w-[calc(100vw-2rem)]",
      "transform transition-all duration-300 ease-in-out",
      "animate-in slide-in-from-top-2",
      isVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
    )}>
      <ErrorAlert
        error={error}
        onRetry={onRetry}
        onDismiss={onDismiss}
        className="shadow-lg backdrop-blur-sm"
        showNetworkStatus={false}
      />
    </div>
  )
}

// Loading alert for operations in progress
interface LoadingAlertProps {
  message: string
  className?: string
}

export function LoadingAlert({ message, className }: LoadingAlertProps) {
  return (
    <Alert className={cn("border-blue-200 bg-blue-50 border shadow-sm", className)}>
      <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
      <div className="flex-1">
        <AlertTitle className="text-sm font-medium text-blue-900">Processing</AlertTitle>
        <AlertDescription className="text-sm text-blue-800 mt-1">
          {message}
        </AlertDescription>
      </div>
    </Alert>
  )
} 