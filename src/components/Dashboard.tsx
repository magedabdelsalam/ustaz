'use client'

/**
 * Dashboard
 * ----------------
 * TODO: Add description and exports for Dashboard.
 */


import { useRef, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSubjects } from '@/hooks/useSubjects'
import { HistoryPane } from '@/components/HistoryPane'
import { ContentPane } from '@/components/ContentPane'
import { ChatPane, ChatPaneRef } from '@/components/ChatPane'
import { Button } from '@/components/ui/button'
import { persistenceService } from '@/lib/persistenceService'
import { InteractiveContent } from '@/types'

export function Dashboard() {
  const { user } = useAuth()
  const { 
    subjects, 
    currentSubject, 
    selectSubject,
    createSubject,
    deleteSubject
  } = useSubjects()
  const chatRef = useRef<ChatPaneRef>(null)
  const lastUserMessageRef = useRef<{ id: string; content: string; previousSubjectId: string | null } | null>(null)

  // Test connection on mount
  useEffect(() => {
    persistenceService.testConnection().then(success => {
      if (success) {
        console.log('✅ Database connection successful')
      } else {
        console.error('❌ Database connection failed')
      }
    })
  }, [])

  // Listen for user messages from ChatPane (for tracking purposes)
  useEffect(() => {
    const handleUserMessage = (event: CustomEvent) => {
      const { messageId, content } = event.detail
      console.log('📝 Dashboard received user message tracking:', { messageId, content })
      
      // Track this message in case it triggers subject creation
      lastUserMessageRef.current = {
        id: messageId,
        content: content,
        previousSubjectId: currentSubject?.id || null
      }
    }

    const handleNewSubjectCreated = (event: CustomEvent) => {
      const { subject, initialMessage, initialResponse } = event.detail

      console.log('🎯 Dashboard received new subject created event:', subject.name)

      // Check if subject already exists by ID
      const subjectExists = subjects.some(s => s.id === subject.id)
      
      if (!subjectExists) {
        // If not, create it
        createSubject(subject.name)
          .then(newSubject => {
            console.log('✅ Created new subject:', newSubject.name)
            // Automatically select this new subject
            selectSubject(newSubject)
            
            // Log the initial messages for context
            if (initialMessage) {
              // Check if initialMessage is an object with content property or a string
              const messageContent = typeof initialMessage === 'string' 
                ? initialMessage 
                : (initialMessage.content || initialMessage.toString());
              console.log('📝 Initial message carried over:', messageContent.substring(0, 30) + '...')
            }
            if (initialResponse) {
              console.log('🤖 Initial response carried over:', initialResponse.content.substring(0, 30) + '...')
            }
            
            // Wait for the subject to be fully saved to the database before saving messages
            // This prevents foreign key constraint errors
            setTimeout(async () => {
              try {
                // Now that subject should be in the database, save the messages
                if (initialMessage && typeof initialMessage === 'object' && initialMessage.content) {
                  // Save the actual messages
                  const userMessageSaved = await persistenceService.saveMessage({
                    id: initialMessage.id || `user-${Date.now()}`,
                    user_id: user?.id || '',
                    subject_id: newSubject.id,
                    role: 'user',
                    content: initialMessage.content,
                    timestamp: initialMessage.timestamp?.toISOString() || new Date().toISOString(),
                    has_generated_content: false
                  });
                  
                  if (userMessageSaved) {
                    console.log('✅ Saved initial user message for new subject');
                  }
                  
                  if (initialResponse) {
                    const aiMessageSaved = await persistenceService.saveMessage({
                      id: initialResponse.id || `ai-${Date.now()}`,
                      user_id: user?.id || '',
                      subject_id: newSubject.id,
                      role: 'assistant',
                      content: initialResponse.content,
                      timestamp: initialResponse.timestamp?.toISOString() || new Date().toISOString(),
                      has_generated_content: initialResponse.hasGeneratedContent || false
                    });
                    
                    if (aiMessageSaved) {
                      console.log('✅ Saved initial AI response for new subject');
                    }
                  }
                }
              } catch (error) {
                console.error('❌ Failed to save initial messages:', error);
              }
            }, 1000); // Wait 1 second for the subject to be saved to the database
          })
          .catch(err => {
            console.error('❌ Failed to create subject:', err)
          })
      } else {
        // If it exists, just select it
        const existingSubject = subjects.find(s => s.id === subject.id)
        if (existingSubject) {
          selectSubject(existingSubject)
          
          // Log the initial messages for context
          if (initialMessage) {
            // Check if initialMessage is an object with content property or a string
            const messageContent = typeof initialMessage === 'string' 
              ? initialMessage 
              : (initialMessage.content || initialMessage.toString());
            console.log('📝 Initial message carried over to existing subject:', messageContent.substring(0, 30) + '...')
          }
          if (initialResponse) {
            console.log('🤖 Initial response carried over to existing subject:', initialResponse.content.substring(0, 30) + '...')
          }
        }
      }
    }

    window.addEventListener('userMessageSent', handleUserMessage as EventListener)
    window.addEventListener('newSubjectCreated', handleNewSubjectCreated as EventListener)
    
    return () => {
      window.removeEventListener('userMessageSent', handleUserMessage as EventListener)
      window.removeEventListener('newSubjectCreated', handleNewSubjectCreated as EventListener)
    }
  }, [currentSubject, subjects, createSubject, selectSubject, user])

  // AI-first message handler - let AI decide everything
  const handleNewMessage = useCallback(async (message: string, isUserMessage = false) => {
    console.log('📩 Message received:', { 
      message: message.substring(0, 50) + '...', 
      isUserMessage
    })

    // Just pass through to AI - no hardcoded logic
    // AI will decide whether to create subjects, switch contexts, etc.
  }, [])

  const handleContentInteraction = async (action: string, data: unknown) => {
    console.log('🎯 Content interaction:', action, data)
    
    if (!chatRef.current) {
      console.error('❌ Chat reference not available')
      return
    }

    try {
      // Handle all the different interaction types from interactive components
      switch (action) {
        // ConceptCard actions
        case 'ready_for_next':
          const interactionData = data as { concept?: string; action?: string; componentId?: string }
          if (interactionData.action === 'practice' && interactionData.concept) {
            console.log('🎯 Practice request for concept:', interactionData.concept)
            await chatRef.current.handleContentInteraction('ready_for_next', {
              concept: interactionData.concept,
              action: 'practice',
              componentId: interactionData.componentId
            })
          } else {
            console.log('🔄 General ready_for_next request')
            await chatRef.current.handleContentInteraction(action, data)
          }
          break

        case 'concept_expanded':
        case 'examples_requested':
          console.log('🧠 Concept expansion/examples request')
          await chatRef.current.handleContentInteraction(action, data)
          break

        // Answer submission actions from all components
        case 'answer_submitted':
        case 'fill_blank_submitted':
        case 'drag_drop_submitted':
          console.log('✅ Answer submitted from interactive component')
          await chatRef.current.handleContentInteraction(action, data)
          break

        // Next content requests
        case 'next_question':
        case 'next_exercise':
        case 'next_problem':
          console.log('➡️ Next content request')
          await chatRef.current.handleContentInteraction(action, data)
          break

        // Reset actions
        case 'reset_question':
        case 'fill_blank_reset':
        case 'drag_drop_reset':
        case 'solver_reset':
          console.log('🔄 Component reset request')
          await chatRef.current.handleContentInteraction(action, data)
          break

        // Explanation requests
        case 'explain_more':
          console.log('📚 Explanation request')
          await chatRef.current.handleContentInteraction(action, data)
          break

        // Special interactive actions
        case 'item_dropped':
        case 'auto_play_started':
          console.log('🎮 Interactive action')
          await chatRef.current.handleContentInteraction(action, data)
          break

        // Fallback for any unhandled actions
        default:
          console.log('🤔 Unhandled interaction type:', action, 'forwarding to ChatPane')
          await chatRef.current.handleContentInteraction(action, data)
          break
      }
    } catch (error) {
      console.error('❌ Failed to handle content interaction:', error)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Main Dashboard Content */}
      <div className="flex-1 flex flex-col lg:flex-row bg-gray-50 overflow-hidden">
        {/* History Pane - Responsive width */}
        <div className="w-full md:w-80 lg:w-72 xl:w-80 2xl:w-96 bg-white border-r border-gray-200 flex-shrink-0 
                        md:block hidden overflow-y-auto">
          <HistoryPane 
            subjects={subjects}
            selectedSubject={currentSubject}
            user={user}
            onSubjectSelect={selectSubject}
            onSubjectDelete={deleteSubject}
          />
        </div>
        
        {/* Mobile History Toggle - Show on mobile */}
        <div className="md:hidden fixed top-4 left-4 z-50">
          <Button
            variant="outline"
            size="sm"
            className="bg-white shadow-lg"
            onClick={() => {
              const historyPane = document.getElementById('mobile-history-pane')
              if (historyPane) {
                historyPane.classList.toggle('hidden')
              }
            }}
          >
            📚 <span className="ml-1">Subjects</span>
          </Button>
        </div>

        {/* Mobile History Pane - Overlay */}
        <div 
          id="mobile-history-pane"
          className="md:hidden fixed inset-0 z-40 bg-black bg-opacity-50 hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              e.currentTarget.classList.add('hidden')
            }
          }}
        >
          <div className="absolute left-0 top-0 h-full w-80 bg-white shadow-xl">
            <div className="h-full overflow-hidden">
              <HistoryPane 
                subjects={subjects}
                selectedSubject={currentSubject}
                user={user}
                showCloseButton={true}
                onClose={() => {
                  const historyPane = document.getElementById('mobile-history-pane')
                  if (historyPane) {
                    historyPane.classList.add('hidden')
                  }
                }}
                onSubjectSelect={(subject) => {
                  selectSubject(subject)
                  // Close mobile menu after selection
                  const historyPane = document.getElementById('mobile-history-pane')
                  if (historyPane) {
                    historyPane.classList.add('hidden')
                  }
                }}
                onSubjectDelete={deleteSubject}
              />
            </div>
          </div>
        </div>
        
        {/* Main Content Area - Responsive layout */}
        <div className="flex-1 flex flex-col lg:flex-row min-w-0 overflow-hidden">
          {/* Content Pane - Responsive sizing with proper flex basis */}
          <div className="flex-1 lg:flex-[3] xl:flex-[3] 2xl:flex-[4] flex flex-col min-w-0 overflow-hidden">
            <ContentPane 
              selectedSubject={currentSubject}
              onContentInteraction={handleContentInteraction}
            />
          </div>
          
          {/* Chat Pane - Fixed width on larger screens, flexible on mobile */}
          <div className="flex-none h-[50vh] lg:h-auto lg:w-80 xl:w-96 2xl:w-[400px] 
                          bg-white border-l border-gray-200 lg:border-t-0 border-t 
                          flex flex-col overflow-hidden">
            <ChatPane 
              ref={chatRef}
              selectedSubject={currentSubject}
              onNewMessage={handleNewMessage}
              onGeneratedContent={(content: InteractiveContent) => {
                console.log('🎯 AI generated interactive content:', content.type);
                // The content will be automatically displayed in ContentPane
                // via the existing event system from the AI tutor callbacks
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
} 