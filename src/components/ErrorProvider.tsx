'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { AppError, errorHandler } from '@/lib/errorHandler'
import { ErrorToast, SuccessAlert } from '@/components/ui/error-alert'
import { cn } from '@/lib/utils'

interface ErrorContextType {
  currentError: AppError | null
  showError: (error: AppError, onRetry?: () => void) => void
  clearError: () => void
  retry: (() => void) | null
  showSuccess: (message: string) => void
  currentSuccess: string | null
  clearSuccess: () => void
}

const ErrorContext = createContext<ErrorContextType | null>(null)

interface ErrorProviderProps {
  children: ReactNode
}

export function ErrorProvider({ children }: ErrorProviderProps) {
  const [currentError, setCurrentError] = useState<AppError | null>(null)
  const [currentSuccess, setCurrentSuccess] = useState<string | null>(null)
  const [retryCallback, setRetryCallback] = useState<(() => void) | null>(null)
  const [errorQueue, setErrorQueue] = useState<Array<{ error: AppError; onRetry?: () => void }>>([])
  const [isOfflineMode, setIsOfflineMode] = useState(false)
  const [offlineErrorCount, setOfflineErrorCount] = useState(0)

  useEffect(() => {
    // Subscribe to global error events
    const unsubscribe = errorHandler.subscribeToErrors((error) => {
      // Check if we're offline and this is a network/database error
      const isOffline = typeof window !== 'undefined' && !navigator.onLine
      const isNetworkError = error.type === 'network' || error.type === 'server'
      
      if (isOffline && isNetworkError) {
        // Handle offline errors differently
        setOfflineErrorCount(prev => prev + 1)
        
        if (!isOfflineMode) {
          // Show offline mode notification instead of individual errors
          setIsOfflineMode(true)
          setCurrentError({
            ...error,
            type: 'network',
            userMessage: 'You\'re offline. Operations will be retried when you reconnect.',
            canRetry: false,
            operation: 'offline_mode'
          })
        }
        return
      }
      
      // Handle normal errors (online or non-network errors)
      if (currentError) {
        setErrorQueue(prev => [...prev, { error }])
      } else {
        setCurrentError(error)
        setRetryCallback(null)
      }
    })

    return unsubscribe
  }, [currentError, isOfflineMode])

  // Listen for online/offline status changes
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => {
      if (isOfflineMode) {
        setIsOfflineMode(false)
        setOfflineErrorCount(0)
        setCurrentError(null)
        
        // Show success message when back online
        if (offlineErrorCount > 0) {
          showSuccess(`Back online! ${offlineErrorCount} operations will be retried.`)
        }
      }
    }

    const handleOffline = () => {
      // Don't immediately set offline mode - wait for actual errors
      console.log('Device went offline')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [isOfflineMode, offlineErrorCount])

  // Process next error in queue when current error is cleared
  useEffect(() => {
    if (!currentError && errorQueue.length > 0 && !isOfflineMode) {
      const nextError = errorQueue[0]
      setErrorQueue(prev => prev.slice(1))
      setCurrentError(nextError.error)
      setRetryCallback(() => nextError.onRetry || null)
    }
  }, [currentError, errorQueue, isOfflineMode])

  const showError = (error: AppError, onRetry?: () => void) => {
    // Check if we're offline and this is a network error
    const isOffline = typeof window !== 'undefined' && !navigator.onLine
    const isNetworkError = error.type === 'network' || error.type === 'server'
    
    if (isOffline && isNetworkError) {
      setOfflineErrorCount(prev => prev + 1)
      if (!isOfflineMode) {
        setIsOfflineMode(true)
        setCurrentError({
          ...error,
          type: 'network',
          userMessage: 'You\'re offline. Operations will be retried when you reconnect.',
          canRetry: false,
          operation: 'offline_mode'
        })
      }
      return
    }

    if (currentError) {
      // Add to queue if there's already an error
      setErrorQueue(prev => [...prev, { error, onRetry }])
    } else {
      setCurrentError(error)
      setRetryCallback(() => onRetry || null)
    }
  }

  const showSuccess = (message: string) => {
    // Clear any existing error when showing success
    setCurrentError(null)
    setIsOfflineMode(false)
    setOfflineErrorCount(0)
    setCurrentSuccess(message)
    // Auto-dismiss success after 3 seconds
    setTimeout(() => {
      setCurrentSuccess(null)
    }, 3000)
  }

  const clearError = () => {
    setCurrentError(null)
    setRetryCallback(null)
    setIsOfflineMode(false)
    setOfflineErrorCount(0)
  }

  const clearSuccess = () => {
    setCurrentSuccess(null)
  }

  const handleRetry = async () => {
    if (retryCallback) {
      try {
        await retryCallback()
        clearError()
      } catch (_error) {
        // The retry failed, error will be handled by the error handler
        console.error('Retry failed:', _error)
      }
    }
  }

  return (
    <ErrorContext.Provider 
      value={{ 
        currentError, 
        showError, 
        clearError, 
        retry: retryCallback ? handleRetry : null,
        showSuccess,
        currentSuccess,
        clearSuccess
      }}
    >
      {children}
      
      {/* Global success toast - Top Center */}
      {currentSuccess && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <div className="w-96 max-w-[calc(100vw-2rem)]">
            <SuccessAlert 
              message={currentSuccess}
              onDismiss={clearSuccess}
            />
          </div>
        </div>
      )}
      
      {/* Global error toast - Top Center */}
      {currentError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <ErrorToast
            error={currentError}
            isVisible={true}
            onRetry={retryCallback ? handleRetry : undefined}
            onDismiss={clearError}
          />
        </div>
      )}
    </ErrorContext.Provider>
  )
}

export function useError() {
  const context = useContext(ErrorContext)
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider')
  }
  return context
}

// Hook for handling async operations with error handling
export function useAsyncOperation() {
  const { showError, clearError } = useError()

  const executeWithErrorHandling = async <T,>(
    operation: () => Promise<T>,
    operationName?: string,
    onRetry?: () => void
  ): Promise<T | null> => {
    try {
      clearError() // Clear any previous errors
      return await operation()
    } catch (_error) {
      const appError = errorHandler.handleError(_error, operationName)
      showError(appError, onRetry)
      return null
    }
  }

  const executeWithRetry = async <T,>(
    operation: () => Promise<T>,
    operationName?: string,
    options?: { maxAttempts?: number; baseDelay?: number }
  ): Promise<T | null> => {
    try {
      clearError()
      return await errorHandler.withRetry(operation, operationName, options)
    } catch {
      // Error is already handled by withRetry
      return null
    }
  }

  return {
    executeWithErrorHandling,
    executeWithRetry
  }
}

// React Error Boundary for catching React errors
interface ErrorBoundaryState {
  hasError: boolean
  errorId: number
}

export class ErrorBoundary extends React.Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, errorId: 0 }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    // Reset error boundary with new error ID to force re-render
    return { hasError: true, errorId: Date.now() }
  }

  componentDidCatch(_error: Error, errorInfo: React.ErrorInfo) {
    // Log error to error handler for centralized processing
    console.error('ErrorBoundary caught an error:', _error, errorInfo)
    errorHandler.handleError(
      new Error(`Component error: ${_error.message}`),
      'error_boundary'
    )
  }

  render() {
    // Always render children with a key to force remount if needed
    return (
      <div key={this.state.errorId}>
        {this.props.children}
      </div>
    )
  }
} 