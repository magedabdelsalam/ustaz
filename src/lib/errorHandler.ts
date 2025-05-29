export type ErrorType = 
  | 'network'
  | 'database'
  | 'permission'
  | 'validation'
  | 'unknown'

export interface AppError {
  type: ErrorType
  message: string
  userMessage: string
  originalError: unknown
  canRetry: boolean
  timestamp: Date
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
    let userMessage = 'Something went wrong. Please try again.'
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
          userMessage = 'A display issue occurred. The app should recover automatically.'
          canRetry = false
        }
        // Network errors
        else if (message.includes('network') || 
            message.includes('fetch') || 
            message.includes('connection') ||
            message.includes('timeout') ||
            message.includes('failed to fetch') ||
            error.name === 'NetworkError') {
          type = 'network'
          userMessage = 'Connection problem. Check your internet and try again.'
        }
        // Supabase/Database errors
        else if (message.includes('supabase') || 
                 message.includes('database') ||
                 message.includes('sql') ||
                 message.includes('constraint') ||
                 message.includes('postgrest')) {
          type = 'database'
          userMessage = 'Database error. Please try again in a moment.'
        }
        // Permission/Auth errors
        else if (message.includes('permission') || 
                 message.includes('unauthorized') ||
                 message.includes('forbidden') ||
                 message.includes('auth')) {
          type = 'permission'
          userMessage = 'Permission denied. Please check your login status.'
          canRetry = false
        }
        // Validation errors
        else if (message.includes('validation') || 
                 message.includes('invalid') ||
                 message.includes('required')) {
          type = 'validation'
          userMessage = 'Invalid data. Please check your input.'
          canRetry = false
        }
      }

      // Check if we're offline (only on client side)
      if (typeof window !== 'undefined' && !navigator.onLine) {
        type = 'network'
        userMessage = 'You appear to be offline. Please check your connection.'
      }
    } catch (classificationError) {
      // If error classification itself fails, use safe defaults
      console.error('Error in error classification:', classificationError)
      type = 'unknown'
      userMessage = 'An unexpected error occurred.'
      canRetry = false
    }

    return {
      type,
      message: error instanceof Error ? error.message : String(error),
      userMessage,
      originalError: error,
      canRetry,
      timestamp: new Date(),
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

    try {
      // Try to fetch a small resource to test actual connectivity
      const response = await fetch('/api/health', { 
        method: 'HEAD',
        cache: 'no-cache'
      })
      return response.ok
    } catch {
      return false
    }
  }

  // Utility method for sleep
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Get user-friendly error message for specific operation
  getOperationErrorMessage(operation: string, error: AppError): string {
    const operationMessages: Record<string, string> = {
      'save_message': 'Failed to save your message',
      'load_messages': 'Failed to load conversation history', 
      'save_subject': 'Failed to save subject',
      'load_subjects': 'Failed to load your subjects',
      'save_content': 'Failed to save content',
      'load_content': 'Failed to load content',
      'delete_subject': 'Failed to delete subject',
      'update_subject': 'Failed to update subject'
    }

    const baseMessage = operationMessages[operation] || 'Operation failed'
    return `${baseMessage}. ${error.userMessage}`
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