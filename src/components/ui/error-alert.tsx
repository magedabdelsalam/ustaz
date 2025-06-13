'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, WifiOff, RefreshCw, X, CheckCircle, Info } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AppError, networkMonitor } from '@/lib/errorHandler'
import { cn } from '@/lib/utils'
import { getOperationErrorMessage } from '@/lib/errorMessages'
import { 
  ErrorAlertProps as TypedErrorAlertProps,
  SuccessAlertProps,
  NetworkStatusProps,
  ErrorToastProps as TypedErrorToastProps,
  LoadingAlertProps
} from '@/types'
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { AlertCircle } from 'lucide-react'

// Custom ErrorAlertProps that extends the centralized one
interface ErrorAlertProps extends Omit<TypedErrorAlertProps, 'message' | 'title'> {
  error: AppError | null
  showNetworkStatus?: boolean
  onRetry?: () => void
  onDismiss?: () => void
}

const errorAlertVariants = cva(
  'relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground',
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground',
        destructive:
          'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive',
        warning:
          'border-warning/50 text-warning dark:border-warning [&>svg]:text-warning',
        info: 'border-info/50 text-info dark:border-info [&>svg]:text-info'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

interface BaseErrorAlertProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof errorAlertVariants> {
  children?: React.ReactNode
}

const BaseErrorAlert = React.forwardRef<HTMLDivElement, BaseErrorAlertProps>(
  ({ className, variant, children, ...props }, ref) => {
    const Icon = {
      default: AlertCircle,
      destructive: AlertCircle,
      warning: AlertTriangle,
      info: Info
    }[variant || 'default']

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(errorAlertVariants({ variant }), className)}
        {...props}
      >
        <Icon className="h-4 w-4" />
        <div>{children}</div>
      </div>
    )
  }
)
BaseErrorAlert.displayName = 'BaseErrorAlert'

const ErrorAlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn('mb-1 font-medium leading-none tracking-tight', className)}
    {...props}
  />
))
ErrorAlertTitle.displayName = 'ErrorAlertTitle'

const ErrorAlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-sm [&_p]:leading-relaxed', className)}
    {...props}
  />
))
ErrorAlertDescription.displayName = 'ErrorAlertDescription'

const ErrorAlertGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('space-y-4', className)}
    {...props}
  />
))
ErrorAlertGroup.displayName = 'ErrorAlertGroup'

const ErrorAlertToast = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof errorAlertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'fixed bottom-4 right-4 z-50 max-w-md rounded-lg border bg-background p-4 shadow-lg',
      className
    )}
    {...props}
  />
))
ErrorAlertToast.displayName = 'ErrorAlertToast'

const ErrorAlertPopover = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof errorAlertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'absolute z-50 max-w-md rounded-lg border bg-background p-4 shadow-lg',
      className
    )}
    {...props}
  />
))
ErrorAlertPopover.displayName = 'ErrorAlertPopover'

const ErrorAlertStatus = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof errorAlertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
      {
        'bg-destructive/15 text-destructive hover:bg-destructive/25':
          variant === 'destructive',
        'bg-warning/15 text-warning hover:bg-warning/25':
          variant === 'warning',
        'bg-info/15 text-info hover:bg-info/25': variant === 'info'
      },
      className
    )}
    {...props}
  />
))
ErrorAlertStatus.displayName = 'ErrorAlertStatus'

const ErrorAlertDialog = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof errorAlertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm',
      className
    )}
    {...props}
  />
))
ErrorAlertDialog.displayName = 'ErrorAlertDialog'

interface ErrorMessage {
  title: string
  description: string
  severity: 'error' | 'warning' | 'info'
  action?: string
  details?: string
}

export function ErrorAlert({ 
  error,
  className,
  showNetworkStatus = true,
  onRetry,
  onDismiss,
  ...props
}: ErrorAlertProps) {
  const [isOnline, setIsOnline] = React.useState(true)
  const [isLoading, setIsLoading] = React.useState(false)

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!error) {
    return null
  }

  const errorMessage: ErrorMessage = typeof error.message === 'string' 
    ? {
        title: 'An error occurred',
        description: error.message,
        severity: 'error'
      }
    : error.message || {
        title: 'An error occurred',
        description: 'Please try again later.',
        severity: 'error'
      }

  return (
    <BaseErrorAlert 
      variant={errorMessage.severity === 'error' ? 'destructive' : errorMessage.severity === 'warning' ? 'warning' : 'info'} 
      className={className}
      {...props}
    >
      <ErrorAlertTitle>
        {errorMessage.title}
      </ErrorAlertTitle>
      <ErrorAlertDescription>
        {errorMessage.description}
        {errorMessage.action && (
          <p className="mt-2">
            <strong>Action:</strong> {errorMessage.action}
          </p>
        )}
        {errorMessage.details && (
          <p className="mt-2">
            <strong>Details:</strong> {errorMessage.details}
          </p>
        )}
      </ErrorAlertDescription>
      {!isOnline && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
          <AlertCircle className="h-3 w-3" />
          <span>You are currently offline</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {error.type && (
            <span className="text-xs text-muted-foreground">
              Type: {error.type}
            </span>
          )}
          {error.timestamp && (
            <span className="text-xs text-muted-foreground">
              Time: {error.timestamp.toLocaleTimeString()}
            </span>
          )}
        </div>
        {error.canRetry && (
          <button
            onClick={() => {
              setIsLoading(true)
              // Handle retry logic here
              setIsLoading(false)
            }}
            disabled={isLoading}
            className="text-xs text-primary hover:underline disabled:opacity-50"
          >
            {isLoading ? 'Retrying...' : 'Retry'}
          </button>
        )}
      </div>
    </BaseErrorAlert>
  )
}

// Success alert for positive feedback
export function SuccessAlert({ message, onDismiss, className }: SuccessAlertProps) {
  return (
    <Alert className={className}>
      <CheckCircle className="h-4 w-4" />
      <div className="flex-1">
        <AlertTitle>Success</AlertTitle>
        <AlertDescription className="mt-1">
          {message}
        </AlertDescription>
        {onDismiss && (
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={onDismiss}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Dismiss</span>
            </Button>
          </div>
        )}
      </div>
    </Alert>
  )
}

// Network status component
export function NetworkStatus({ isOnline, className, onReconnect }: NetworkStatusProps) {
  const [isOnlineState, setIsOnlineState] = useState(isOnline)

  useEffect(() => {
    const unsubscribe = networkMonitor.subscribe(setIsOnlineState)
    return unsubscribe
  }, [])

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {isOnlineState ? (
        <>
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          {onReconnect && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onReconnect}
            >
              Reconnect
            </Button>
          )}
        </>
      ) : (
        <>
          <div className="h-2 w-2 rounded-full bg-red-500" />
          {onReconnect && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onReconnect}
            >
              Reconnect
            </Button>
          )}
        </>
      )}
    </div>
  )
}

// Network status badge
export function NetworkStatusBadge({ className }: { className?: string }) {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    const unsubscribe = networkMonitor.subscribe(setIsOnline)
    return unsubscribe
  }, [])

  return (
    <Badge 
      variant={isOnline ? "default" : "destructive"}
      className={cn("text-xs", className)}
    >
      {isOnline ? "Online" : "Offline"}
    </Badge>
  )
}

// Toast variant of error alert
interface ErrorToastProps extends Omit<TypedErrorToastProps, 'message'> {
  error: AppError
  duration?: number
  onRetry?: () => void
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
    <div className="w-96 max-w-[calc(100vw-2rem)]">
      <ErrorAlert
        error={error}
        onRetry={onRetry}
        onDismiss={onDismiss}
        showNetworkStatus={false}
      />
    </div>
  )
}

// Loading alert for in-progress operations
export function LoadingAlert({ message, className }: LoadingAlertProps) {
  return (
    <BaseErrorAlert variant="info" className={className}>
      <ErrorAlertTitle>Loading</ErrorAlertTitle>
      <ErrorAlertDescription>{message}</ErrorAlertDescription>
    </BaseErrorAlert>
  )
}

export {
  BaseErrorAlert,
  ErrorAlertTitle,
  ErrorAlertDescription,
  ErrorAlertGroup,
  ErrorAlertToast,
  ErrorAlertPopover,
  ErrorAlertStatus,
  ErrorAlertDialog
} 