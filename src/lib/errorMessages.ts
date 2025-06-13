import { ErrorType } from './errorHandler'

// Error message categories
export type ErrorCategory = 
  | 'network'
  | 'authentication'
  | 'authorization'
  | 'validation'
  | 'resource'
  | 'system'
  | 'user'

// Standard error message format
export interface ErrorMessage {
  title: string
  description: string
  action?: string
  category: ErrorCategory
  type: ErrorType
  severity: 'error' | 'warning' | 'info'
}

// Error message templates by category
export const errorMessages: Record<ErrorCategory, Record<ErrorType, ErrorMessage>> = {
  network: {
    network: {
      title: 'Connection Issue',
      description: 'Unable to connect to the server. Please check your internet connection.',
      action: 'Try again when you have a stable connection.',
      category: 'network',
      type: 'network',
      severity: 'error'
    },
    database: {
      title: 'Database Connection Error',
      description: 'Unable to connect to the database. Your data may not be saved.',
      action: 'Please try again in a few moments.',
      category: 'network',
      type: 'database',
      severity: 'error'
    },
    server: {
      title: 'Server Unavailable',
      description: 'The server is currently unavailable.',
      action: 'Please try again later.',
      category: 'network',
      type: 'server',
      severity: 'error'
    },
    permission: {
      title: 'Permission Error',
      description: 'You don\'t have permission to perform this action.',
      action: 'Please contact support if you believe this is an error.',
      category: 'network',
      type: 'permission',
      severity: 'error'
    },
    validation: {
      title: 'Invalid Request',
      description: 'The request could not be processed.',
      action: 'Please check your input and try again.',
      category: 'network',
      type: 'validation',
      severity: 'error'
    },
    auth: {
      title: 'Authentication Error',
      description: 'Your session has expired or is invalid.',
      action: 'Please sign in again.',
      category: 'network',
      type: 'auth',
      severity: 'error'
    },
    unknown: {
      title: 'Unknown Error',
      description: 'An unexpected error occurred.',
      action: 'Please try again or contact support.',
      category: 'network',
      type: 'unknown',
      severity: 'error'
    }
  },
  authentication: {
    network: {
      title: 'Authentication Failed',
      description: 'Unable to verify your credentials.',
      action: 'Please check your connection and try again.',
      category: 'authentication',
      type: 'network',
      severity: 'error'
    },
    database: {
      title: 'Account Error',
      description: 'Unable to access your account information.',
      action: 'Please try again in a few moments.',
      category: 'authentication',
      type: 'database',
      severity: 'error'
    },
    server: {
      title: 'Authentication Service Unavailable',
      description: 'The authentication service is temporarily unavailable.',
      action: 'Please try again later.',
      category: 'authentication',
      type: 'server',
      severity: 'error'
    },
    permission: {
      title: 'Access Denied',
      description: 'You don\'t have permission to access this resource.',
      action: 'Please contact support if you believe this is an error.',
      category: 'authentication',
      type: 'permission',
      severity: 'error'
    },
    validation: {
      title: 'Invalid Credentials',
      description: 'The provided credentials are invalid.',
      action: 'Please check your input and try again.',
      category: 'authentication',
      type: 'validation',
      severity: 'error'
    },
    auth: {
      title: 'Session Expired',
      description: 'Your session has expired.',
      action: 'Please sign in again.',
      category: 'authentication',
      type: 'auth',
      severity: 'error'
    },
    unknown: {
      title: 'Authentication Error',
      description: 'An unexpected error occurred during authentication.',
      action: 'Please try again or contact support.',
      category: 'authentication',
      type: 'unknown',
      severity: 'error'
    }
  },
  authorization: {
    network: {
      title: 'Authorization Failed',
      description: 'Unable to verify your permissions.',
      action: 'Please check your connection and try again.',
      category: 'authorization',
      type: 'network',
      severity: 'error'
    },
    database: {
      title: 'Permission Check Failed',
      description: 'Unable to verify your access rights.',
      action: 'Please try again in a few moments.',
      category: 'authorization',
      type: 'database',
      severity: 'error'
    },
    server: {
      title: 'Authorization Service Unavailable',
      description: 'The authorization service is temporarily unavailable.',
      action: 'Please try again later.',
      category: 'authorization',
      type: 'server',
      severity: 'error'
    },
    permission: {
      title: 'Insufficient Permissions',
      description: 'You don\'t have the required permissions for this action.',
      action: 'Please contact support if you believe this is an error.',
      category: 'authorization',
      type: 'permission',
      severity: 'error'
    },
    validation: {
      title: 'Invalid Permission Request',
      description: 'The permission request is invalid.',
      action: 'Please check your input and try again.',
      category: 'authorization',
      type: 'validation',
      severity: 'error'
    },
    auth: {
      title: 'Authentication Required',
      description: 'You must be signed in to perform this action.',
      action: 'Please sign in and try again.',
      category: 'authorization',
      type: 'auth',
      severity: 'error'
    },
    unknown: {
      title: 'Authorization Error',
      description: 'An unexpected error occurred during authorization.',
      action: 'Please try again or contact support.',
      category: 'authorization',
      type: 'unknown',
      severity: 'error'
    }
  },
  validation: {
    network: {
      title: 'Validation Failed',
      description: 'Unable to validate your input.',
      action: 'Please check your connection and try again.',
      category: 'validation',
      type: 'network',
      severity: 'warning'
    },
    database: {
      title: 'Data Validation Error',
      description: 'The provided data is invalid.',
      action: 'Please check your input and try again.',
      category: 'validation',
      type: 'database',
      severity: 'warning'
    },
    server: {
      title: 'Validation Service Unavailable',
      description: 'The validation service is temporarily unavailable.',
      action: 'Please try again later.',
      category: 'validation',
      type: 'server',
      severity: 'warning'
    },
    permission: {
      title: 'Invalid Permission',
      description: 'The requested permission is invalid.',
      action: 'Please check your input and try again.',
      category: 'validation',
      type: 'permission',
      severity: 'warning'
    },
    validation: {
      title: 'Invalid Input',
      description: 'Please check your input and try again.',
      action: 'Make sure all required fields are filled correctly.',
      category: 'validation',
      type: 'validation',
      severity: 'warning'
    },
    auth: {
      title: 'Invalid Authentication',
      description: 'The authentication request is invalid.',
      action: 'Please check your credentials and try again.',
      category: 'validation',
      type: 'auth',
      severity: 'warning'
    },
    unknown: {
      title: 'Validation Error',
      description: 'An unexpected error occurred during validation.',
      action: 'Please check your input and try again.',
      category: 'validation',
      type: 'unknown',
      severity: 'warning'
    }
  },
  resource: {
    network: {
      title: 'Resource Unavailable',
      description: 'Unable to access the requested resource.',
      action: 'Please check your connection and try again.',
      category: 'resource',
      type: 'network',
      severity: 'error'
    },
    database: {
      title: 'Resource Not Found',
      description: 'The requested resource could not be found.',
      action: 'Please check the resource ID and try again.',
      category: 'resource',
      type: 'database',
      severity: 'error'
    },
    server: {
      title: 'Resource Service Unavailable',
      description: 'The resource service is temporarily unavailable.',
      action: 'Please try again later.',
      category: 'resource',
      type: 'server',
      severity: 'error'
    },
    permission: {
      title: 'Resource Access Denied',
      description: 'You don\'t have permission to access this resource.',
      action: 'Please contact support if you believe this is an error.',
      category: 'resource',
      type: 'permission',
      severity: 'error'
    },
    validation: {
      title: 'Invalid Resource Request',
      description: 'The resource request is invalid.',
      action: 'Please check your input and try again.',
      category: 'resource',
      type: 'validation',
      severity: 'error'
    },
    auth: {
      title: 'Resource Authentication Required',
      description: 'You must be signed in to access this resource.',
      action: 'Please sign in and try again.',
      category: 'resource',
      type: 'auth',
      severity: 'error'
    },
    unknown: {
      title: 'Resource Error',
      description: 'An unexpected error occurred while accessing the resource.',
      action: 'Please try again or contact support.',
      category: 'resource',
      type: 'unknown',
      severity: 'error'
    }
  },
  system: {
    network: {
      title: 'System Error',
      description: 'A system error occurred while processing your request.',
      action: 'Please try again later.',
      category: 'system',
      type: 'network',
      severity: 'error'
    },
    database: {
      title: 'Database Error',
      description: 'A database error occurred.',
      action: 'Please try again in a few moments.',
      category: 'system',
      type: 'database',
      severity: 'error'
    },
    server: {
      title: 'Server Error',
      description: 'An internal server error occurred.',
      action: 'Please try again later.',
      category: 'system',
      type: 'server',
      severity: 'error'
    },
    permission: {
      title: 'System Permission Error',
      description: 'A system permission error occurred.',
      action: 'Please contact support.',
      category: 'system',
      type: 'permission',
      severity: 'error'
    },
    validation: {
      title: 'System Validation Error',
      description: 'A system validation error occurred.',
      action: 'Please try again later.',
      category: 'system',
      type: 'validation',
      severity: 'error'
    },
    auth: {
      title: 'System Authentication Error',
      description: 'A system authentication error occurred.',
      action: 'Please try again later.',
      category: 'system',
      type: 'auth',
      severity: 'error'
    },
    unknown: {
      title: 'Unknown System Error',
      description: 'An unexpected system error occurred.',
      action: 'Please try again or contact support.',
      category: 'system',
      type: 'unknown',
      severity: 'error'
    }
  },
  user: {
    network: {
      title: 'User Action Failed',
      description: 'Unable to process your action.',
      action: 'Please check your connection and try again.',
      category: 'user',
      type: 'network',
      severity: 'error'
    },
    database: {
      title: 'User Data Error',
      description: 'Unable to process your data.',
      action: 'Please try again in a few moments.',
      category: 'user',
      type: 'database',
      severity: 'error'
    },
    server: {
      title: 'User Service Unavailable',
      description: 'The service is temporarily unavailable.',
      action: 'Please try again later.',
      category: 'user',
      type: 'server',
      severity: 'error'
    },
    permission: {
      title: 'User Permission Error',
      description: 'You don\'t have permission to perform this action.',
      action: 'Please contact support if you believe this is an error.',
      category: 'user',
      type: 'permission',
      severity: 'error'
    },
    validation: {
      title: 'Invalid User Input',
      description: 'Please check your input and try again.',
      action: 'Make sure all required fields are filled correctly.',
      category: 'user',
      type: 'validation',
      severity: 'warning'
    },
    auth: {
      title: 'User Authentication Required',
      description: 'You must be signed in to perform this action.',
      action: 'Please sign in and try again.',
      category: 'user',
      type: 'auth',
      severity: 'error'
    },
    unknown: {
      title: 'User Action Error',
      description: 'An unexpected error occurred while processing your action.',
      action: 'Please try again or contact support.',
      category: 'user',
      type: 'unknown',
      severity: 'error'
    }
  }
}

// Helper function to get error message by category and type
export function getErrorMessage(category: ErrorCategory, type: ErrorType): ErrorMessage {
  return errorMessages[category][type]
}

// Helper function to get error message by operation
export function getOperationErrorMessage(operation: string, type: ErrorType): ErrorMessage {
  // Map operations to categories
  const operationCategoryMap: Record<string, ErrorCategory> = {
    'save_message': 'user',
    'load_messages': 'resource',
    'save_subject': 'user',
    'load_subjects': 'resource',
    'delete_subject': 'user',
    'update_subject': 'user',
    'ai_tutor_api': 'system',
    'save_content': 'user',
    'load_content': 'resource',
    'authentication': 'authentication',
    'authorization': 'authorization'
  }

  const category = operationCategoryMap[operation] || 'system'
  return getErrorMessage(category, type)
} 