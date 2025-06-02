import { useState, useCallback } from 'react'
import { Message, UseSubjectSessionProps } from '@/types'
import { persistenceService } from '@/lib/persistenceService'

export function useSubjectSession({ 
  user, 
  selectedSubject,
  onMessagesLoaded
}: UseSubjectSessionProps) {
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)

  const loadSubjectSession = useCallback(async () => {
    if (!selectedSubject || !user) {
      // Clear session when no subject
      if (onMessagesLoaded) onMessagesLoaded([])
      return
    }

    console.log('🔄 Loading subject session:', selectedSubject.name)
    console.log('🆔 User:', { id: user.id })
    console.log('🎯 Subject:', { id: selectedSubject.id, name: selectedSubject.name })

    try {
      // Load messages from persistence
      setIsLoadingMessages(true)
      const persistedMessages = await persistenceService.getMessagesBySubject(user.id, selectedSubject.id)
      console.log('📥 Loaded messages from DB:', persistedMessages.length)
      
      const loadedMessages: Message[] = persistedMessages.map(pm => ({
        id: pm.id,
        role: pm.role,
        content: pm.content,
        timestamp: new Date(pm.timestamp),
        hasGeneratedContent: pm.has_generated_content
      }))
      
      if (onMessagesLoaded) {
        onMessagesLoaded(loadedMessages)
      }
      
    } catch (error) {
      console.error('❌ Failed to load subject session:', error)
      if (onMessagesLoaded) onMessagesLoaded([])
    } finally {
      setIsLoadingMessages(false)
    }
  }, [user, selectedSubject, onMessagesLoaded])

  return {
    loadSubjectSession,
    isLoadingMessages
  }
} 