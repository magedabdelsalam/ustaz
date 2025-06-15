'use client'

/**
 * ChatPane
 * --------
 * Main chat interface used on the dashboard.  It wires the `useAITutor` hook
 * with the UI, keeps message history and handles sending/receiving messages.
 *
 * Exports:
 *   - `ChatPane` React component
 *   - `ChatPaneRef` ref interface used for imperative interactions
 */

import React, { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { Send, MessageCircle } from 'lucide-react'
import { Message, Subject, InteractiveContent } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { useAITutor } from '@/hooks/useAITutor'
import { useSubjectSession } from '@/hooks/useSubjectSession'
import { persistenceService } from '@/lib/persistenceService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SpinnerIcon } from '@/components/ui/loading-spinner'
import { ChatMessageList } from './ChatMessageList'
import { supabase } from '@/lib/supabase'
import { errorHandler } from '@/lib/errorHandler'

interface ChatPaneProps {
  selectedSubject: Subject | null
  onNewMessage?: (message: string, isUserMessage?: boolean) => void
  onGeneratedContent?: (content: InteractiveContent) => void
}

export interface ChatPaneRef {
  handleContentInteraction: (action: string, data: unknown) => void
}

const ChatPane = forwardRef<ChatPaneRef, ChatPaneProps>(({ selectedSubject, onNewMessage, onGeneratedContent }, ref) => {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // AI Tutor - the single source of truth for all decisions
  const aiTutor = useAITutor({
    subject: selectedSubject,
    onSubjectCreated: (subject) => {
      console.log('🎯 AI created subject:', subject.name);
    },
    onLessonPlanCreated: (lessonPlan) => {
      console.log('📋 AI created lesson plan:', lessonPlan);
    },
    onProgressUpdated: (progress) => {
      console.log('📈 AI updated progress:', progress);
    },
    onInteractiveContent: (content) => {
      console.log('🎯 AI generated content:', content.type);
      if (onGeneratedContent) {
        onGeneratedContent(content);
      }
    },
    onClarifyingQuestion: () => {
      console.log('❓ AI asking for clarification');
    },
    instructionOverrides: {
      preferInteractiveContent: true,
      interactiveContentGuidelines: `
        When explaining educational topics like quadratic equations:
        1. ALWAYS create interactive components for teaching concepts
        2. Put the detailed explanations, steps, and formulas INTO the component
        3. Use appropriate components (explainer, interactive-example, step-solver)
        4. Keep chat messages brief and direct users to the interactive content
        5. For math topics, use formula-explorer and step-solver components
      `
    },
    userId: user?.id
  });

  const { loadSubjectSession, isLoadingMessages } = useSubjectSession({
    user,
    selectedSubject,
    onMessagesLoaded: (loadedMessages) => {
      setMessages(loadedMessages)
    }
  })

  // Load messages when subject changes
  useEffect(() => {
    if (selectedSubject && user) {
      loadSubjectSession()
      aiTutor.updateContext({ subject: selectedSubject });
    } else {
      setMessages([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubject?.id, user?.id])

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      requestAnimationFrame(() => {
        if (scrollAreaRef.current) {
          const viewport = scrollAreaRef.current.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement
          const scrollTarget = viewport || scrollAreaRef.current
          
          if (scrollTarget && scrollTarget.scrollHeight > scrollTarget.clientHeight) {
            void scrollTarget.offsetHeight
            scrollTarget.scrollTop = scrollTarget.scrollHeight
          }
        }
      })
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (!isLoadingMessages && messages.length > 0) {
      const scrollAttempts = [100, 250, 500]
      scrollAttempts.forEach(delay => {
        setTimeout(() => {
          scrollToBottom()
        }, delay)
      })
    }
  }, [isLoadingMessages, messages.length, scrollToBottom])

  // Enhanced message persistence with better validation
  const saveMessageToPersistence = useCallback(async (message: Message) => {
    // 1. Authentication timing check
    if (!user) {
      console.error("❌ Cannot save message: user is not authenticated");
      return false;
    }
    
    // 2. Subject existence check
    if (!selectedSubject) {
      console.error("❌ Cannot save message: no subject selected");
      return false;
    }
    
    try {
      // Create the persisted message object
      const persistedMessage = {
        id: message.id,
        user_id: user.id,
        subject_id: selectedSubject.id,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp.toISOString(),
        has_generated_content: message.hasGeneratedContent || false
      };
      
      // 3. Message validation - check all required fields
      console.log("🔍 Validating message fields:", persistedMessage);
      const missingFields = [];
      
      if (!persistedMessage.id) missingFields.push('id');
      if (!persistedMessage.user_id) missingFields.push('user_id');
      if (!persistedMessage.subject_id) missingFields.push('subject_id');
      if (!persistedMessage.role) missingFields.push('role');
      if (!persistedMessage.content) missingFields.push('content');
      if (!persistedMessage.timestamp) missingFields.push('timestamp');
      
      if (missingFields.length > 0) {
        console.error(`❌ Message validation failed - missing: ${missingFields.join(', ')}`);
        return false;
      }
      
      // Test connection first
      const connectionStatus = await persistenceService.testConnection();
      if (!connectionStatus) {
        console.error('❌ Database connection test failed before saving message');
      }
      
      console.log("💾 Attempting to save validated message to persistence service");
      const success = await persistenceService.saveMessage(persistedMessage);
      
      if (!success) {
        console.warn('⚠️ Message save was not successful. Will try direct DB insert as fallback.');
        
        // If persistence service fails, try direct DB insert as fallback
        try {
          const { error } = await supabase
            .from('chat_messages')
            .insert(persistedMessage);
            
          if (error) {
            console.error("❌ Fallback direct insert failed:", error);
            return false;
          } else {
            console.log("✅ Fallback direct insert succeeded");
            return true;
          }
        } catch (directError) {
          console.error("❌ Fallback direct insert threw exception:", directError);
          return false;
        }
      }
      
      return success;
    } catch (error) {
      console.error('❌ Message save failed with exception:', error);
      return false;
    }
  }, [user, selectedSubject]);

  // Main message handler - pure AI interaction
  const handleSendMessage = async () => {
    const currentInput = inputValue.trim()
    if (!currentInput || isTyping) return

    setInputValue('')
    setIsTyping(true)

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: currentInput,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    const messageSaved = await saveMessageToPersistence(userMessage)
    
    if (!messageSaved) {
      console.warn('⚠️ Failed to save user message, but continuing with conversation')
    }

    // Notify parent
    if (onNewMessage) {
      await onNewMessage(currentInput, true)
    }

    // Emit a custom event to track this message (Dashboard will listen for this)
    const trackEvent = new CustomEvent('userMessageSent', {
      detail: {
        messageId: userMessage.id,
        content: currentInput
      }
    });
    window.dispatchEvent(trackEvent);

    try {
      // Let AI decide everything
      const aiResult = await aiTutor.sendMessageWithMetadata(currentInput);

      // Check if a new subject was created
      if (aiResult.newSubjectCreated && aiResult.newSubjectData) {
        console.log('🎯 ChatPane detected new subject creation:', aiResult.newSubjectData.name);
        
        // Add the AI response to storage so it can be retrieved later
        const assistantMessage: Message = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: aiResult.response,
          timestamp: new Date(),
          hasGeneratedContent: aiResult.hasGeneratedInteractiveContent
        };
        
        // Don't try to save messages yet - the subject might not be in the DB
        // Just store the messages in memory for now and emit the event
        // The receiving component will handle saving these messages
        
        // Emit a custom event to trigger subject redirection
        const newSubjectEvent = new CustomEvent('newSubjectCreated', {
          detail: {
            subject: aiResult.newSubjectData,
            initialMessage: userMessage,
            initialResponse: assistantMessage
          }
        });
        window.dispatchEvent(newSubjectEvent);
        
        // Don't add a message here - we'll redirect to the new subject page
        setIsTyping(false);
        return;
      }

      const assistantMessage: Message = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: aiResult.response,
        timestamp: new Date(),
        hasGeneratedContent: aiResult.hasGeneratedInteractiveContent
      }

      setMessages(prev => [...prev, assistantMessage])
      const aiMessageSaved = await saveMessageToPersistence(assistantMessage)
      
      if (!aiMessageSaved) {
        console.warn('⚠️ Failed to save AI response, but continuing with conversation')
      }

    } catch (error) {
      console.error('❌ AI conversation error:', error)
      const appError = errorHandler.handleError(error, 'chat_send')

      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${appError.userMessage}`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
    }
  }

  // Content interactions - let AI handle them
  const handleContentInteraction = useCallback(async (action: string, data: unknown) => {
    if (!selectedSubject) return;
    
    try {
      const aiResult = await aiTutor.sendMessageWithMetadata(`User interacted: ${action} - ${JSON.stringify(data)}`);
      
      const responseMessage: Message = {
        id: `interaction-${Date.now()}`,
        role: 'assistant',
        content: aiResult.response,
        timestamp: new Date(),
        hasGeneratedContent: aiResult.hasGeneratedInteractiveContent
      }
      
      setMessages(prev => [...prev, responseMessage])
      await saveMessageToPersistence(responseMessage)

    } catch (error) {
      console.error('❌ Interaction error:', error)
      errorHandler.handleError(error, 'content_interaction')
    }
  }, [selectedSubject, aiTutor, saveMessageToPersistence])

  useImperativeHandle(ref, () => ({
    handleContentInteraction: (action: string, data: unknown) => {
      handleContentInteraction(action, data)
    }
  }), [handleContentInteraction])

  // Simple retry - just re-ask the AI
  const handleChatRetry = useCallback(async (originalAction: string) => {
    if (!selectedSubject) return

    setIsTyping(true)
    
    try {
      const aiResult = await aiTutor.sendMessageWithMetadata(`Please help with: ${originalAction}`)
      
      const retryMessage: Message = {
        id: `retry-${Date.now()}`,
        role: 'assistant',
        content: aiResult.response,
        timestamp: new Date(),
        hasGeneratedContent: aiResult.hasGeneratedInteractiveContent
      }
      
      setMessages(prev => [...prev, retryMessage])
      await saveMessageToPersistence(retryMessage)
      
    } catch (error) {
      console.error('❌ Retry failed:', error)
      errorHandler.handleError(error, 'chat_retry')
    } finally {
      setIsTyping(false)
    }
  }, [selectedSubject, aiTutor, saveMessageToPersistence])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Dynamic placeholder - let AI decide the appropriate prompts
  const getPlaceholderText = (): string => {
    if (!selectedSubject) {
      return "What would you like to learn today?"
    }
    return `Continue learning ${selectedSubject.name}...`
  }

  if (!selectedSubject) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-sm">
            <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">AI Tutor Ready</h3>
            <p className="text-gray-600 mb-4">
              Start learning with your personal AI tutor. I&apos;ll create interactive content based on what you want to learn.
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex-shrink-0">
          <div className="flex space-x-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={getPlaceholderText()}
              disabled={isTyping}
              className="flex-1 p-6 px-4 text-lg"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isTyping}
              size="lg"
              className="p-6 bg-blue-600 hover:bg-blue-700 flex-shrink-0"
            >
              {isTyping ? (
                <SpinnerIcon size="sm" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <ChatMessageList
          messages={messages}
          isTyping={isTyping}
          isLoading={isLoadingMessages}
          pendingCount={0}
          scrollRef={scrollAreaRef}
          onRetryMessage={handleChatRetry}
          lessonInfo={undefined}
          progressInfo={undefined}
        />
      </div>

      <div className="p-4 border-t border-gray-200 flex-shrink-0">
        <div className="flex space-x-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={getPlaceholderText()}
            disabled={isTyping}
            className="flex-1 p-6 px-4 text-lg"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isTyping}
            size="lg"
            className="p-6 bg-blue-600 hover:bg-blue-700 flex-shrink-0"
          >
            {isTyping ? (
              <SpinnerIcon size="sm" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
})

ChatPane.displayName = 'ChatPane'

export { ChatPane } 