import { getOperationErrorMessage } from './errorMessages'

export type ErrorType = 
  | 'validation'
  | 'network' 
  | 'server'
  | 'auth'
  | 'database'
  | 'permission'
  | 'unknown'

export interface AppError {
  type: ErrorType
  message: string
  userMessage: string
  originalError?: Error
  canRetry: boolean
  timestamp: Date
  severity: 'error' | 'warning' | 'info'
  operation?: string
}

export interface RetryOptions {
  maxAttempts?: number
  baseDelay?: number
  maxDelay?: number
  backoffFactor?: number
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffFactor: 2
}

export class ErrorHandler {
  private static instance: ErrorHandler
  private errorListeners: Set<(error: AppError) => void> = new Set()

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler()
    }
    return ErrorHandler.instance
  }

  // Subscribe to error events for UI notifications
  subscribeToErrors(callback: (error: AppError) => void): () => void {
    this.errorListeners.add(callback)
    return () => this.errorListeners.delete(callback)
  }

  // Emit error to all listeners
  private emitError(error: AppError): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error)
      } catch (err) {
        console.error('Error in error listener:', err)
      }
    })
  }

  // Convert unknown error to AppError
  handleError(error: unknown, operation?: string): AppError {
    const appError = this.classifyError(error, operation)
    this.emitError(appError)
    return appError
  }

  // Classify error type and create user-friendly message
  private classifyError(error: unknown, operation?: string): AppError {
    let type: ErrorType = 'unknown'
    let userMessage = 'An unexpected error occurred. Please try again.'
    let canRetry = true

    try {
      if (error instanceof Error) {
        const message = error.message.toLowerCase()
        
        // React-specific errors that shouldn't crash the app
        if (message.includes('react') || 
            message.includes('render') ||
            message.includes('component') ||
            message.includes('hook') ||
            operation === 'react_render') {
          type = 'unknown'
          userMessage = 'A display issue occurred. The page will refresh automatically.'
          canRetry = false
        }
        // Network errors - more specific messaging
        else if (message.includes('network') || 
            message.includes('fetch') || 
            message.includes('connection') ||
            message.includes('timeout') ||
            message.includes('failed to fetch') ||
            error.name === 'NetworkError') {
          type = 'network'
          if (message.includes('timeout')) {
            userMessage = 'Request timed out. Check your internet connection and try again.'
          } else if (message.includes('fetch')) {
            userMessage = 'Unable to reach the server. Please check your connection.'
          } else {
            userMessage = 'Network error. Verify your internet connection and retry.'
          }
        }
        // Database/Storage errors - more specific messaging
        else if (message.includes('supabase') || 
                 message.includes('database') ||
                 message.includes('sql') ||
                 message.includes('constraint') ||
                 message.includes('postgrest') ||
                 message.includes('storage')) {
          type = 'database'
          if (message.includes('constraint')) {
            userMessage = 'Data validation failed. Please check your input and try again.'
            canRetry = false
          } else if (message.includes('storage')) {
            userMessage = 'Storage error. Please wait a moment and try again.'
          } else {
            userMessage = 'Database error. Please try again in a few moments.'
          }
        }
        // Server errors - more specific messaging
        else if (message.includes('server') ||
                 message.includes('internal') ||
                 message.includes('500') ||
                 message.includes('502') ||
                 message.includes('503')) {
          type = 'server'
          if (message.includes('500')) {
            userMessage = 'Server error (500). Our team has been notified. Please try again later.'
          } else if (message.includes('502') || message.includes('503')) {
            userMessage = 'Service temporarily unavailable. Please try again in a few minutes.'
          } else {
            userMessage = 'Server error. Please try again shortly.'
          }
        }
        // Permission/Auth errors - more specific messaging
        else if (message.includes('permission') || 
                 message.includes('unauthorized') ||
                 message.includes('forbidden') ||
                 message.includes('auth') ||
                 message.includes('401') ||
                 message.includes('403')) {
          type = 'permission'
          if (message.includes('401') || message.includes('unauthorized')) {
            userMessage = 'Authentication required. Please sign in and try again.'
          } else if (message.includes('403') || message.includes('forbidden')) {
            userMessage = 'Access denied. You don\'t have permission for this action.'
          } else {
            userMessage = 'Permission error. Please check your access rights.'
          }
          canRetry = false
        }
        // Validation errors - more specific messaging
        else if (message.includes('validation') || 
                 message.includes('invalid') ||
                 message.includes('required') ||
                 message.includes('400')) {
          type = 'validation'
          if (message.includes('required')) {
            userMessage = 'Required fields are missing. Please fill in all required information.'
          } else if (message.includes('invalid')) {
            userMessage = 'Invalid input detected. Please check your data and try again.'
          } else {
            userMessage = 'Data validation failed. Please review your input.'
          }
          canRetry = false
        }
        // AI/OpenAI specific errors
        else if (message.includes('openai') ||
                 message.includes('api key') ||
                 message.includes('rate limit') ||
                 message.includes('model') ||
                 message.includes('assistant')) {
          type = 'server'
          if (message.includes('rate limit') || message.includes('429')) {
            userMessage = 'AI service is busy. Please wait a moment and try again.'
          } else if (message.includes('api key')) {
            userMessage = 'AI service configuration error. Please contact support.'
            canRetry = false
          } else if (message.includes('model')) {
            userMessage = 'AI model temporarily unavailable. Please try again later.'
          } else {
            userMessage = 'AI service error. Please try again in a moment.'
          }
        }
      }

      // Check if we're offline (only on client side)
      if (typeof window !== 'undefined' && !navigator.onLine) {
        type = 'network'
        userMessage = 'You appear to be offline. Please check your internet connection.'
      }

      // Apply operation-specific context if available
      if (operation) {
        userMessage = this.getContextualErrorMessage(operation, type, userMessage)
      }

    } catch (classificationError) {
      // If error classification itself fails, use safe defaults
      console.error('Error in error classification:', classificationError)
      type = 'unknown'
      userMessage = 'An unexpected error occurred. Please refresh the page.'
      canRetry = false
    }

    return {
      type,
      message: error instanceof Error ? error.message : String(error),
      userMessage,
      originalError: error instanceof Error ? error : undefined,
      canRetry,
      timestamp: new Date(),
      severity: 'error' as const,
      operation
    }
  }

  // Retry logic with exponential backoff
  async withRetry<T>(
    operation: () => Promise<T>,
    operationName?: string,
    options: RetryOptions = {}
  ): Promise<T> {
    const config = { ...DEFAULT_RETRY_OPTIONS, ...options }
    let lastError: unknown

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error
        
        // If it's the last attempt, don't wait
        if (attempt === config.maxAttempts) {
          break
        }

        // Check if error is retryable
        const appError = this.classifyError(error, operationName)
        if (!appError.canRetry) {
          break
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffFactor, attempt - 1),
          config.maxDelay
        )

        // Add some jitter (±25% of delay)
        const jitter = delay * 0.25 * (Math.random() * 2 - 1)
        const actualDelay = Math.max(0, delay + jitter)

        console.log(`Attempt ${attempt} failed for ${operationName || 'operation'}. Retrying in ${Math.round(actualDelay)}ms...`)
        await this.sleep(actualDelay)
      }
    }

    // All attempts failed
    throw this.handleError(lastError, operationName)
  }

  // Check network connectivity
  async checkConnectivity(): Promise<boolean> {
    // Only available on client side
    if (typeof window === 'undefined') {
      return true // Assume connected during SSR
    }

    if (!navigator.onLine) {
      return false
    }
    
    // If navigator.onLine is true, we'll do a simple check
    // by trying to load a favicon or a small resource from a reliable CDN
    try {
      const timeoutPromise = new Promise<Response>((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), 3000);
      });
      
      const fetchPromise = fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        mode: 'no-cors', // This is important for CORS issues
        cache: 'no-store'
      });
      
      // Race between fetch and timeout
      await Promise.race([fetchPromise, timeoutPromise]);
      return true; // If fetch succeeds without timeout, we're online
    } catch (error) {
      console.warn('Connectivity check failed:', error);
      return false; // If fetch fails, we're likely offline
    }
  }

  // Utility method for sleep
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Get contextual error message based on operation and error type
  private getContextualErrorMessage(operation: string, errorType: ErrorType, baseMessage: string): string {
    const errorMessage = getOperationErrorMessage(operation, errorType)
    return `${errorMessage.description} ${errorMessage.action || ''}`
  }

  // Get user-friendly error message for specific operation
  getOperationErrorMessage(operation: string, error: AppError): string {
    const errorMessage = getOperationErrorMessage(operation, error.type)
    return `${errorMessage.title}: ${errorMessage.description}`
  }
}

// Global error handler instance
export const errorHandler = ErrorHandler.getInstance()

// Network status monitoring
export class NetworkMonitor {
  private static instance: NetworkMonitor | null = null
  private isOnline = true
  private listeners: Set<(isOnline: boolean) => void> = new Set()
  private isInitialized = false

  private constructor() {
    // Only initialize on client side
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine
      this.setupEventListeners()
      this.isInitialized = true
    }
  }

  static getInstance(): NetworkMonitor {
    if (!NetworkMonitor.instance) {
      NetworkMonitor.instance = new NetworkMonitor()
    }
    return NetworkMonitor.instance
  }

  private setupEventListeners(): void {
    if (typeof window === 'undefined') return

    window.addEventListener('online', () => {
      this.isOnline = true
      this.notifyListeners()
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
      this.notifyListeners()
    })
  }

  subscribe(callback: (isOnline: boolean) => void): () => void {
    this.listeners.add(callback)
    
    // Only call immediately if we're on the client side and initialized
    if (this.isInitialized) {
      callback(this.isOnline)
    }
    
    return () => this.listeners.delete(callback)
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.isOnline)
      } catch (error) {
        console.error('Error in network listener:', error)
      }
    })
  }

  get online(): boolean {
    // Default to online during SSR
    if (typeof window === 'undefined') {
      return true
    }
    return this.isOnline
  }
}

// Lazy initialization to avoid SSR issues
let networkMonitorInstance: NetworkMonitor | null = null

export const networkMonitor = {
  get instance(): NetworkMonitor {
    if (!networkMonitorInstance) {
      networkMonitorInstance = NetworkMonitor.getInstance()
    }
    return networkMonitorInstance
  },
  
  subscribe: (callback: (isOnline: boolean) => void) => {
    return networkMonitor.instance.subscribe(callback)
  },
  
  get online(): boolean {
    return networkMonitor.instance.online
  }
} 