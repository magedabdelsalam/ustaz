import { useRef, useCallback } from 'react'
import { persistenceService } from '@/lib/persistenceService'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  hasGeneratedContent?: boolean
}

interface UsePendingMessagesProps {
  user?: { id: string } | null
  selectedSubject?: { id: string } | null
  onRetrySuccess?: (savedMessages: Message[]) => void
}

export function usePendingMessages({ 
  user, 
  selectedSubject, 
  onRetrySuccess 
}: UsePendingMessagesProps) {
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const scheduleRetry = useCallback(async (pendingMessages: Message[]) => {
    if (pendingMessages.length === 0 || !selectedSubject || !user) return

    console.log(`🔄 Scheduling retry for ${pendingMessages.length} pending messages`)
    
    // Clear any existing retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
    }
    
    // Set up a retry after 3 seconds
    retryTimeoutRef.current = setTimeout(async () => {
      console.log('🔄 Retrying pending messages...')
      const messagesToRetry = [...pendingMessages]
      const savedMessages: Message[] = []
      
      for (const message of messagesToRetry) {
        try {
          await persistenceService.saveMessage({
            id: message.id,
            user_id: user.id,
            subject_id: selectedSubject.id,
            role: message.role,
            content: message.content,
            timestamp: message.timestamp.toISOString(),
            has_generated_content: message.hasGeneratedContent || false
          })
          savedMessages.push(message)
          console.log('✅ Retried message saved successfully:', message.id)
        } catch (error: unknown) {
          console.log('❌ Retry failed for message:', message.id, error)
          // Keep failed messages in pending queue
        }
      }
      
      // Notify about successfully saved messages
      if (savedMessages.length > 0 && onRetrySuccess) {
        onRetrySuccess(savedMessages)
        console.log(`✅ Successfully saved ${savedMessages.length} pending messages`)
      }
    }, 3000)
  }, [selectedSubject, user, onRetrySuccess])

  const clearRetry = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
  }, [])

  return {
    scheduleRetry,
    clearRetry
  }
} 