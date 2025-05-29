# Error Handling and Retry System

A robust error handling system has been implemented to provide better user experience when Supabase operations fail due to network issues or other problems.

## 🚀 Features

### 1. **Automatic Error Classification**
- **Network Errors**: Connection issues, timeouts, offline status
- **Database Errors**: Supabase/SQL constraint violations, database failures
- **Permission Errors**: Authentication/authorization issues  
- **Validation Errors**: Invalid data input
- **Unknown Errors**: Fallback for unclassified errors

### 2. **Retry Logic with Exponential Backoff**
- Automatic retry for retryable errors (network, database)
- Exponential backoff with jitter to prevent thundering herd
- Configurable retry attempts, delays, and backoff factors
- Non-retryable errors (permission, validation) fail immediately

### 3. **User-Friendly Error Messages**
- Technical errors converted to user-friendly messages
- Contextual operation-specific error messages
- Visual error indicators with appropriate styling
- Network status monitoring and display

### 4. **UI Components**
- **ErrorAlert**: Inline error display with retry button
- **ErrorToast**: Toast-style notifications for errors
- **NetworkStatus**: Real-time connectivity indicator
- Global error boundary for React rendering errors

## 📁 File Structure

```
src/
├── lib/
│   ├── errorHandler.ts          # Core error handling logic
│   ├── persistenceService.ts    # Updated with error handling
│   └── utils.ts                 # Utility functions
├── components/
│   ├── ErrorProvider.tsx        # Global error context & boundary
│   └── ui/
│       └── error-alert.tsx      # Error UI components
├── hooks/
│   └── useSupabaseOperations.ts # Hook for DB operations
└── app/
    ├── layout.tsx               # Updated with ErrorProvider
    └── api/health/route.ts      # Health check endpoint
```

## 🛠️ Usage Examples

### Basic Error Handling with Retry

```typescript
import { useSupabaseOperations } from '@/hooks/useSupabaseOperations'

function MyComponent() {
  const { saveMessage, isLoading } = useSupabaseOperations()
  
  const handleSave = async () => {
    // Automatically handles errors and retries
    await saveMessage(messageData)
  }
  
  return (
    <button onClick={handleSave} disabled={isLoading}>
      {isLoading ? 'Saving...' : 'Save Message'}
    </button>
  )
}
```

### Manual Error Handling

```typescript
import { useAsyncOperation } from '@/components/ErrorProvider'
import { errorHandler } from '@/lib/errorHandler'

function MyComponent() {
  const { executeWithRetry, executeWithErrorHandling } = useAsyncOperation()
  
  const handleOperation = async () => {
    // With automatic retry
    const result = await executeWithRetry(
      () => myAsyncOperation(),
      'my_operation',
      { maxAttempts: 5, baseDelay: 2000 }
    )
    
    // Or handle manually
    try {
      await myRiskyOperation()
    } catch (error) {
      const appError = errorHandler.handleError(error, 'risky_operation')
      // Error is automatically shown to user
    }
  }
}
```

### Using Error Components

```tsx
import { ErrorAlert, NetworkStatus } from '@/components/ui/error-alert'
import { useError } from '@/components/ErrorProvider'

function MyComponent() {
  const { currentError, clearError } = useError()
  
  return (
    <div>
      <NetworkStatus />
      
      {currentError && (
        <ErrorAlert 
          error={currentError}
          onRetry={() => retryOperation()}
          onDismiss={clearError}
        />
      )}
    </div>
  )
}
```

## ⚙️ Configuration

### Default Retry Options
```typescript
const DEFAULT_RETRY_OPTIONS = {
  maxAttempts: 3,        // Maximum retry attempts
  baseDelay: 1000,       // Initial delay (1 second)
  maxDelay: 10000,       // Maximum delay (10 seconds)
  backoffFactor: 2       // Exponential backoff multiplier
}
```

### Custom Retry Configuration
```typescript
await errorHandler.withRetry(
  () => myOperation(),
  'operation_name',
  {
    maxAttempts: 5,
    baseDelay: 2000,      // Start with 2 seconds
    maxDelay: 30000,      // Cap at 30 seconds
    backoffFactor: 1.5    // Slower exponential growth
  }
)
```

## 🎯 Error Types and Handling

| Error Type | Retryable | User Message | Common Causes |
|------------|-----------|--------------|---------------|
| `network` | ✅ Yes | "Connection problem. Check your internet and try again." | Offline, timeouts, network failures |
| `database` | ✅ Yes | "Database error. Please try again in a moment." | Supabase errors, SQL constraints |
| `permission` | ❌ No | "Permission denied. Please check your login status." | Auth failures, RLS violations |
| `validation` | ❌ No | "Invalid data. Please check your input." | Data validation failures |
| `unknown` | ✅ Yes | "Something went wrong. Please try again." | Unclassified errors |

## 🔧 Integration with Existing Code

### PersistenceService
All methods now use error handling with retry:
```typescript
// Before
async saveMessage(message) {
  try {
    const { error } = await supabase.from('chat_messages').insert([message])
    if (error) throw error
  } catch (error) {
    console.error('Failed to save message:', error)
  }
}

// After
async saveMessage(message) {
  await errorHandler.withRetry(
    async () => {
      const { error } = await supabase.from('chat_messages').insert([message])
      if (error) throw new Error(`Database error: ${error.message}`)
    },
    'save_message',
    DEFAULT_RETRY_OPTIONS
  )
}
```

### useSupabaseOperations Hook
Provides easy access to all persistence operations with built-in error handling:
```typescript
const {
  saveMessage,
  loadMessages,
  saveSubject,
  loadSubjects,
  testConnection,
  isLoading
} = useSupabaseOperations()
```

## 🌐 Network Monitoring

### Real-time Network Status
- Monitors `navigator.onLine` status
- Tests actual connectivity via health endpoint
- Shows network status indicator in UI
- Automatically detects offline/online transitions

### Health Check Endpoint
- `GET /api/health` - Returns `{ status: 'ok' }`
- `HEAD /api/health` - Returns 200 status
- Used for connectivity testing

## 🎨 UI Components

### ErrorAlert
```tsx
<ErrorAlert 
  error={appError}
  onRetry={() => retryOperation()}
  onDismiss={() => clearError()}
  showNetworkStatus={true}
  className="mb-4"
/>
```

### ErrorToast
```tsx
<ErrorToast
  error={appError}
  onRetry={() => retryOperation()}
  onDismiss={() => clearError()}
  duration={6000}
/>
```

### NetworkStatus
```tsx
<NetworkStatus className="text-sm" />
```

## 🔄 Error Flow

1. **Error Occurs**: Database operation fails
2. **Classification**: Error is analyzed and classified
3. **User Notification**: User-friendly message is shown
4. **Retry Logic**: If retryable, automatic retry with backoff
5. **User Action**: User can manually retry or dismiss
6. **Resolution**: Error clears on successful operation

## 🚨 Testing Error Scenarios

### Simulate Network Errors
1. Turn off Wi-Fi/internet connection
2. Try to save or load data
3. Observe network error handling

### Test Database Errors
1. Use invalid Supabase credentials
2. Trigger constraint violations
3. Observe database error handling

### Test Connection Recovery
1. Go offline, perform operations
2. Come back online
3. Use "Test Connection" button
4. Retry failed operations

## 🔮 Best Practices

1. **Always use the provided hooks** for database operations
2. **Don't show technical errors** to users - let the system handle it
3. **Test offline scenarios** during development
4. **Use appropriate retry settings** for different operations
5. **Monitor error patterns** to identify systemic issues

## 🐛 Troubleshooting

### Common Issues

**Error not showing in UI:**
- Ensure `ErrorProvider` wraps your app
- Check that error context is properly used

**Infinite retry loops:**
- Check error classification logic
- Verify non-retryable errors are properly identified

**Network status not updating:**
- Ensure `NetworkMonitor` is initialized
- Check browser's online/offline events

### Debug Mode
Enable detailed logging by checking browser console for:
- `🔄 Attempt X failed for operation_name. Retrying...`
- `❌ Supabase error:` messages
- Network connectivity test results

This error handling system provides a robust foundation for handling all types of failures gracefully while keeping users informed and providing clear paths to resolution. 